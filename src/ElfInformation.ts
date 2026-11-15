import { execFile } from "child_process";
import { promisify } from "util";
import { ElfElement, ElfInfo } from "../common/elfInfo";
import * as vscode from 'vscode';
import { logChannel } from "./extension";

const execFileAsync = promisify(execFile);

export async function getElfInfo(file: string): Promise<ElfInfo> {
    try {
        logChannel.info("get info from", file);

        const toolNM = vscode.workspace.getConfiguration()
            .get<string>("devprodest-elf-analyzer.toolchain-nm-bin-path") ?? "llvm-nm";

        const { stdout, stderr } = await execFileAsync(
            toolNM,
            ["-S", "-l", "-t", "d", "--format=sysv", file],
            {
                maxBuffer: 64 * 1024 * 1024, // Увеличили до 64MB на случай больших файлов
                windowsHide: true,
            },
        );

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

        // Если мы распарсили 0 элементов, значит либо файл пустой, либо формат не совпал
        if (elements.length === 0) {
            if (stdout.trim().length > 0) {
                logChannel.warn("llvm-nm output is not empty, but no elements were parsed. Snippet:", stdout.substring(0, 500));
            }
            return {
                file,
                elements: [],
                error: stderr.trim() || "No symbols found in this ELF file. It might be stripped, or you need to check your toolchain binary path in settings.",
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