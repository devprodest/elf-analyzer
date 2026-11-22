

export type ElfElement = {
    name: string,
    address: number,
    class: string,
    type: string,
    size: number,
    section: string,
    isDead?: boolean,
    line?: string,
}


export type ElfInfo = {
    file: string,
    elements: ElfElement[],
    error?: string,
}
