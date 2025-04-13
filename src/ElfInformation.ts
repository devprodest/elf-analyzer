import { execSync } from "child_process";
import { ElfElement, ElfInfo } from "../common/elfInfo";

// llvm-nm test.elf -S -l -t dec --format=sysv

export async function getElfInfo(file: string): Promise<ElfInfo | null> {
    try {
        const rawlines = execSync('llvm-nm -S -l -t d --format=sysv ' + file, {}).toString()
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
                section: section_line?.[1].toString(),
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