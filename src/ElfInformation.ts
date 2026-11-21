import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { ElfElement, ElfInfo } from "../common/elfInfo";
import * as vscode from 'vscode';
import { logChannel } from "./extension";

const execFileAsync = promisify(execFile);

// Каскадный поиск нужной утилиты (nm или readelf)
async function findTool(toolName: 'nm' | 'readelf'): Promise<string | null> {
    const config = vscode.workspace.getConfiguration('devprodest-elf-analyzer');
    const prefix = config.get<string>('prefix') || '';
    const toolchainPath = config.get<string>('toolchain-path') || '';
    const candidates: string[] = [];

    // 1. Старая настройка (обратная совместимость)
    if (toolName === 'nm') {
        const legacy = config.get<string>('toolchain-nm-bin-path');
        if (legacy) candidates.push(legacy);
    }

    // 2. Настройки папки и префикса
    if (toolchainPath) {
        candidates.push(path.join(toolchainPath, `${prefix}${toolName}`));
    }
    if (prefix) {
        candidates.push(`${prefix}${toolName}`);
    }

    // 3. Стандартные фолбэки (LLVM -> GNU)
    candidates.push(`llvm-${toolName}`, toolName);

    for (const cmd of candidates) {
        try {
            await execFileAsync(cmd, ['--version'], { timeout: 1000 });
            return cmd;
        } catch (e) {
            // Игнорируем ошибку и пробуем следующий
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
    // Mach-O: CF FA ED FE (64-bit LE) или FE ED FA CF (64-bit BE)
    if ((buffer[0] === 0xCF && buffer[1] === 0xFA && buffer[2] === 0xED && buffer[3] === 0xFE) ||
        (buffer[0] === 0xFE && buffer[1] === 0xED && buffer[2] === 0xFA && buffer[3] === 0xCF)) {
        return 'macho';
    }
    // PE: MZ
    if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
        return 'pe';
    }
    return 'unknown';
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
                        targetFile = debugPath; // Меняем цель на .debug файл
                    }
                }
            } catch (e) {
                logChannel.info("No .gnu_debuglink found or failed to read.");
            }
        }

        // 2. Запускаем nm на найденном файле (оригинале или .debug)
        const toolNM = await findTool('nm');
        if (!toolNM) {
            return { file, elements: [], error: "nm (or llvm-nm) not found in PATH or settings." };
        }

        // (Дальше стандартный код вызова nm для ELF)
        const { stdout, stderr } = await execFileAsync(toolNM, ["-S", "-l", "-t", "d", "--format=sysv", targetFile], {
            maxBuffer: 64 * 1024 * 1024,
            windowsHide: true,
        });

        const elements = parseElfOutput(stdout);

        if (elements.length === 0) {
            return {
                file,
                elements: [],
                error: stderr.trim() || "No symbols found in this file or its .debug link.",
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
    const rawlines = stdout
        .split("\n")
        .map(l => l.split("|"))
        .filter(l => l.length > 6);

    const elements: ElfElement[] = [];

    for (const l of rawlines) {
        const field = l.map(f => f.trim());
        if (!field[0] || field[0] === "Name") continue;

        const sectionLine = field[6].match(/^(\.[\w.]+)\s*(.*)/);
        const address = parseInt(field[1], 10);
        const size = parseInt(field[4], 10);

        elements.push({
            name: field[0],
            address: isNaN(address) ? 0 : address,
            class: field[2],
            type: field[3],
            size: isNaN(size) ? 0 : size,
            section: sectionLine?.[1] ?? "",
            line: sectionLine?.[2]?.trim() ?? "",
        });
    }
    return elements;
}

function parseMachOOutput(stdout: string): ElfElement[] {
    // Формат вывода darwin (llvm-nm -m) выглядит примерно так:
    // 0000000000000000 (__TEXT,__text) external _main
    // или
    // 0000000000000000 (__DATA,__data) non-external _foo
    const lines = stdout.split("\n").filter(l => l.trim().length > 0);
    const elements: ElfElement[] = [];

    for (const line of lines) {
        // Пропускаем заголовки и пустые строки
        if (line.startsWith("Name") || line.startsWith("---")) continue;

        // Регулярка для парсинга: адрес, (сегмент,секция), флаги, имя
        const match = line.match(/^([0-9a-fA-F]+)\s+\(([^,]+),([^)]+)\)\s+(.*?)\s+([^\s].*)$/);
        if (!match) continue;

        const address = parseInt(match[1], 16);
        const segment = match[2];
        const section = match[3];
        const rest = match[4];
        const name = match[5];

        // Определяем тип по флагам (external/non-external и т.д.)
        // Для простоты считаем все функции FUNC, данные OBJECT
        // В Mach-O точный тип (FUNC/OBJECT) не всегда очевиден из nm, но можно ориентироваться на секцию
        let type = "OBJECT";
        if (section === "__text") type = "FUNC";
        if (section === "__bss") type = "OBJECT";

        // Размер в Mach-O nm не выводится напрямую (только адрес).
        // Мы можем вычислить его позже, отсортировав по адресу и найдя разницу.
        // Пока ставим 0, размер будет вычислен на фронтенде или отдельным проходом.
        elements.push({
            name,
            address: isNaN(address) ? 0 : address,
            class: rest.includes("external") ? "T" : "t",
            type,
            size: 0, // Будет вычислено позже
            section: `${segment},${section}`,
            line: "",
        });
    }

    // Вычисляем размеры: сортируем по адресу, размер = следующий_адрес - текущий_адрес
    // Это приблизительно, но для nm это стандартный подход
    elements.sort((a, b) => a.address - b.address);
    for (let i = 0; i < elements.length - 1; i++) {
        if (elements[i].address > 0) {
            elements[i].size = elements[i + 1].address - elements[i].address;
        }
    }

    return elements.filter(e => e.address > 0);
}