import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { ElfElement, ElfInfo } from "../common/elfInfo";
import * as vscode from 'vscode';
import { logChannel } from "./extension";

const execFileAsync = promisify(execFile);

// Каскадный поиск нужной утилиты (nm, readelf или objdump)
async function findTool(toolName: 'nm' | 'readelf' | 'objdump'): Promise<string | null> {
    const config = vscode.workspace.getConfiguration('devprodest-elf-analyzer');
    const prefix = config.get<string>('prefix') || '';
    const toolchainPath = config.get<string>('toolchain-path') || '';
    const candidates: string[] = [];

    if (toolName === 'nm') {
        const legacy = config.get<string>('toolchain-nm-bin-path');
        if (legacy) candidates.push(legacy);
    }

    if (toolchainPath) candidates.push(path.join(toolchainPath, `${prefix}${toolName}`));
    if (prefix) candidates.push(`${prefix}${toolName}`);

    candidates.push(`llvm-${toolName}`, toolName);

    for (const cmd of candidates) {
        try {
            await execFileAsync(cmd, ['--version'], { timeout: 1000 });
            return cmd;
        } catch (e) {
            // ignore
        }
    }
    return null;
}

async function detectFormat(filePath: string): Promise<'elf' | 'macho' | 'pe' | 'unknown'> {
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);

    if (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
        return 'elf';
    }
    if ((buffer[0] === 0xCF && buffer[1] === 0xFA && buffer[2] === 0xED && buffer[3] === 0xFE) ||
        (buffer[0] === 0xFE && buffer[1] === 0xED && buffer[2] === 0xFA && buffer[3] === 0xCF)) {
        return 'macho';
    }
    if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
        return 'pe';
    }
    return 'unknown';
}

function markDeadCode(elements: ElfElement[], referencedSymbols: Set<string>) {
    // Символы, которые не должны помечаться как мертвые (точки входа)
    const keepAlive = ['main', '_start', 'Reset_Handler', 'Default_Handler', '_exit', 'exit', '__libc_init_array'];

    for (const el of elements) {
        // Проверяем только локальные символы (t, d, b, r - строчные буквы)
        // Заглавные буквы (T, D, B, R) — это глобальные символы, они не могут быть удалены линкером
        if (el.class && el.class === el.class.toLowerCase() && el.class.match(/[tdbr]/)) {
            if (!referencedSymbols.has(el.name) && !keepAlive.includes(el.name)) {
                el.isDead = true;
            }
        }
    }
}

export async function getElfInfo(file: string): Promise<ElfInfo> {
    try {
        logChannel.info("get info from", file);
        let targetFile = file;

        // 1. Пытаемся найти внешний .debug файл
        const readelf = await findTool('readelf');
        if (readelf) {
            try {
                const { stdout } = await execFileAsync(readelf, ['--string-dump=.gnu_debuglink', file]);
                const match = stdout.match(/\[\s*\d+\]\s+(.+)/);
                if (match) {
                    const debugName = match[1].trim().replace(/\0/g, '');
                    const debugPath = path.join(path.dirname(file), debugName);
                    if (fs.existsSync(debugPath)) {
                        logChannel.info("Found separate debug file:", debugPath);
                        targetFile = debugPath;
                    }
                }
            } catch (e) {
                logChannel.info("No .gnu_debuglink found or failed to read.");
            }
        }

        // 2. Запускаем nm на найденном файле
        const toolNM = await findTool('nm');
        if (!toolNM) {
            return { file, elements: [], error: "nm (or llvm-nm) not found in PATH or settings." };
        }

        const format = await detectFormat(targetFile);
        let args: string[] = [];
        let parser: (stdout: string) => ElfElement[];

        if (format === 'macho') {
            args = ["-m", "-S", "-l", targetFile];
            parser = parseMachOOutput;
        } else {
            args = ["-S", "-l", "-t", "d", "--format=sysv", targetFile];
            parser = parseElfOutput;
        }

        const { stdout, stderr } = await execFileAsync(toolNM, args, {
            maxBuffer: 64 * 1024 * 1024,
            windowsHide: true,
        });

        const elements = parser(stdout);

        // 3. Поиск мертвого кода (только для ELF)
        if (format === 'elf') {
            try {
                logChannel.info("Running disassembly and relocations for dead code analysis...");
                const referencedSymbols = new Set<string>();

                // 3.1. Ищем вызовы функций через objdump -d
                const toolObjdump = await findTool('objdump');
                if (toolObjdump) {
                    const { stdout: objdumpStdout } = await execFileAsync(toolObjdump, ["-d", targetFile], {
                        maxBuffer: 64 * 1024 * 1024,
                        windowsHide: true
                    });
                    // Ищем все имена в угловых скобках (например: bl 8000a1c <my_function>)
                    const matches = objdumpStdout.matchAll(/<([^>]+)>/g);
                    for (const match of matches) {
                        const name = match[1].split('+')[0].trim();
                        if (name) referencedSymbols.add(name);
                    }
                }

                // 3.2. Ищем указатели на данные через readelf -r
                if (readelf) {
                    const { stdout: readelfStdout } = await execFileAsync(readelf, ["-r", targetFile]);
                    const matches = readelfStdout.matchAll(/R_[A-Z0-9_]+\s+[0-9a-fA-F]+\s+([^\s+]+)/g);
                    for (const match of matches) {
                        referencedSymbols.add(match[1]);
                    }
                }

                markDeadCode(elements, referencedSymbols);
            } catch (e) {
                logChannel.warn("Failed to analyze dead code:", e);
            }
        }

        if (elements.length === 0) {
            return {
                file,
                elements: [],
                error: stderr.trim() || `No symbols found in this ${format.toUpperCase()} file.`,
            };
        }

        return { file, elements };
    } catch (error) {
        logChannel.error("getElfInfo failed", file, error);
        return {
            file,
            elements: [],
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

function parseElfOutput(stdout: string): ElfElement[] {
    const lines = stdout.split("\n");
    const elements: ElfElement[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("Name")) continue;

        let objectFile = "";
        let restOfLine = trimmed;

        const fileMatch = trimmed.match(/^([^|]+\.(o|obj|a|elf)):\s*(.*)$/i);
        if (fileMatch) {
            objectFile = fileMatch[1];
            restOfLine = fileMatch[3];
        } else {
            const colonMatch = trimmed.match(/^([^|]+):\s*(.*)$/);
            if (colonMatch && trimmed.includes("|")) {
                objectFile = colonMatch[1].trim();
                restOfLine = colonMatch[2];
            }
        }

        const parts = restOfLine.split("|").map(p => p.trim());
        if (parts.length < 5) continue;

        const name = parts[0];
        const address = parseInt(parts[1], 10);
        const size = parseInt(parts[4], 10);
        const sectionLine = parts[6] ? parts[6].match(/^(\.[\w.]+)\s*(.*)/) : null;

        elements.push({
            name: name,
            address: isNaN(address) ? 0 : address,
            class: parts[2] || "",
            type: parts[3] || "",
            size: isNaN(size) ? 0 : size,
            section: sectionLine?.[1] ?? "",
            line: sectionLine?.[2]?.trim() ?? "",
        });
    }
    return elements;
}

function parseMachOOutput(stdout: string): ElfElement[] {
    const lines = stdout.split("\n").filter(l => l.trim().length > 0);
    const elements: ElfElement[] = [];

    for (const line of lines) {
        if (line.startsWith("Name") || line.startsWith("---")) continue;

        const match = line.match(/^([0-9a-fA-F]+)\s+\(([^,]+),([^)]+)\)\s+(.*?)\s+([^\s].*)$/);
        if (!match) continue;

        const address = parseInt(match[1], 16);
        const segment = match[2];
        const section = match[3];
        const rest = match[4];
        const name = match[5];

        let type = "OBJECT";
        if (section === "__text") type = "FUNC";
        if (section === "__bss") type = "OBJECT";

        elements.push({
            name,
            address: isNaN(address) ? 0 : address,
            class: rest.includes("external") ? "T" : "t",
            type,
            size: 0,
            section: `${segment},${section}`,
            line: "",
        });
    }

    elements.sort((a, b) => a.address - b.address);
    for (let i = 0; i < elements.length - 1; i++) {
        if (elements[i].address > 0) {
            elements[i].size = elements[i + 1].address - elements[i].address;
        }
    }

    return elements.filter(e => e.address > 0);
}