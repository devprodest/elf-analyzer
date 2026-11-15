<template>
    <div class="my-table">
        <div class="my-table-header-group" style="display: contents">
            <div class="my-table-row my-table-header-row" style="display: contents">
                <div class="my-table-cell" :class="head.class" v-for="head in fields"
                    :key="head.key" :sort="sortby === head.key" @click="sort(head)">
                    {{ head.title }}
                </div>
            </div>
        </div>

        <div class="my-table-row-group" style="display: contents">
            <template v-for="(row, i) in items" :key="row.isGroup ? row.key : i">
                <!-- Заголовок группы (растягивается на все колонки) -->
                <div v-if="row.isGroup" class="my-table-group-row" :style="{ gridColumn: `1 / -1` }" @click.stop.prevent="toggleGroup(row.key)">
                    <div class="my-table-group-cell">
                        <span class="my-table-group-toggle">{{ row.collapsed ? '▶' : '▼' }}</span>
                        <strong class="my-table-group-title">{{ row.title }}</strong>
                        <span class="my-table-group-stats">{{ row.count }} items, {{ row.totalSize }} bytes</span>
                    </div>
                </div>
                
                <!-- Обычная строка -->
                <div v-else class="my-table-row" style="display: contents" @click.stop.prevent="onRowClick(row.item)">
                    <div class="my-table-cell" v-for="g in fields" :key="g.key">
                        <slot :name="g.key" :data="row.item[g.key]" :item="row.item">
                            {{ row.item[g.key] }}
                        </slot>
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

export interface MyTableField {
    key: string;
    title: string;
    width?: string;
    class?: string;
    sortable?: boolean;
}

export type TableRow = 
    | { isGroup: true; key: string; title: string; count: number; totalSize: number; collapsed: boolean }
    | { isGroup: false; item: any; [key: string]: any };

const props = defineProps<{
    fields: Array<MyTableField>;
    items: Array<any>;
    sortby?: string;
    sortdesc?: boolean;
}>();

const emit = defineEmits(['rowclick', 'detailopen', 'sortchange', 'update:sortby', 'update:sortdesc', 'togglegroup']);

const sortby = computed({
    get: () => props.sortby,
    set: (value) => emit('update:sortby', value)
});
const sortdesc = computed({
    get: () => props.sortdesc,
    set: (value) => emit('update:sortdesc', value)
});

const sort = (head: MyTableField) => {
    if (head.sortable == false) return;
    if (sortby.value === head.key) sortdesc.value = !sortdesc.value;
    sortby.value = head.key;
    emit('sortchange', sortby.value, sortdesc.value);
}

const onRowClick = (item: any) => {
    emit('rowclick', item);
}

const toggleGroup = (key: string) => {
    emit('togglegroup', key);
}
</script>

<style lang="scss">
.my-table {
    display: grid;
    /* Фиксируем ширину колонок: Name, Address, Size, Section, File */
    grid-template-columns: minmax(150px, 2fr) 110px 100px minmax(120px, 1fr) minmax(150px, 3fr);
    width: 100%;
    text-align: left;
    align-items: center;
}

.my-table-cell {
    padding: .5em;
    overflow: hidden;
    white-space: nowrap;
    display: flex;
    align-items: center;
    height: 100%;
    box-sizing: border-box;
}

.my-table-header-row .my-table-cell {
    background-color: var(--vscode-list-hoverBackground);
    color: var(--vscode-editor-foreground);
    cursor: pointer;
    position: sticky;
    top: 0;
    z-index: 10;
    font-weight: bold;
    border-radius: 0 !important;
}

.my-table-header-row .my-table-cell[sort=true] {
    background-color: var(--vscode-button-background);
    border-radius: 5px;
}

.my-table-row-group .my-table-row .my-table-cell {
    border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
}

/* Строка группы растягивается благодаря grid-column: 1 / -1 (задано инлайн) */
.my-table-group-row {
    background-color: var(--vscode-list-inactiveSelectionBackground, rgba(128, 128, 128, 0.1));
    cursor: pointer;
    font-weight: 500;
    border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
    border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
    position: sticky;
    left: 0;
    z-index: 5;
}

.my-table-group-cell {
    padding: 0.3em 0.5em;
    display: flex;
    align-items: center;
    font-size: 0.9em;
}

.my-table-group-toggle {
    display: inline-block;
    width: 20px;
    font-size: 0.8rem;
    color: var(--vscode-editor-foreground);
}

.my-table-group-title {
    margin-right: 1rem;
}

.my-table-group-stats {
    font-size: 0.85em;
    color: var(--vscode-descriptionForeground);
    font-weight: normal;
}
</style>