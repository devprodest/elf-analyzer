import { execSync } from "child_process";
import { ElfElement, ElfInfo } from "../common/elfInfo";
import * as vscode from 'vscode';
import { logChannel } from "./extension";


export async function getElfInfo(file: string): Promise<ElfInfo | null> {
    try {
        logChannel.info("get info from", file);

        const toolNM = vscode.workspace.getConfiguration().get<string>("devprodest-elf-analyzer.toolchain-nm-bin-path") ?? "llvm-nm";

        const rawlines = execSync(`"${toolNM}" -S -l -t d --format=sysv "${file}"`, {}).toString()
            .split("\n").map(l => l.split("|")).filter(l => l.length > 5);


        const elements: ElfElement[] = rawlines.map((l) => {
            const field = l.map(f => f.trim());
            const section_line = field[6].match(/^(\.[\w]*) *([\w\W]*)/);

            const line = section_line?.[2].toString().trim();

            return {
                name: field[0],
                address: parseInt(field[1]),
                class: field[2],
                type: field[3],
                size: parseInt(field[4]),
                section: section_line?.[1].toString() ?? "",
                line
            };
        }
        );

        return {
            file,
            elements,
        };
    }
    catch (error) {
    }

    return null;
}