<template>
    <div class="my-table">
        <div class="my-table-column-group">
            <span class="my-table-column" :class="col.class" :width="col.width" v-for="col in fields" :key="col.key">
            </span>
        </div>

        <div class="my-table-header-group">
            <div class="my-table-row my-table-header-row">
                <div class="my-table-cell" :class="head.class" v-for="head in fields"
                    :key="head.key" :sort="sortby === head.key" @click="sort(head)">
                    {{ head.title }}
                </div>
            </div>
        </div>

        <div class="my-table-row-group">
            <div class="my-table-row" v-for="(item, i) in items" :key="i" @click.stop.prevent="onRowClick(item)">
                <div class="my-table-cell" v-for="g in fields" :key="g.key" >
                    <slot :name="g.key" :data="item[g.key]" :item="item" :key="item">
                        {{ item[g.key] }}
                    </slot>
                </div>
            </div>
        </div>
    </div>
</template>


<style lang="scss">
.my-table {
    width: 100%;
    border-collapse: collapse;
    display: table;

    .my-table-column-group {
        display: table-column-group;

        .my-table-column{
            display: table-column;
        }
    }

    .my-table-cell {
        display: table-cell;
        padding: .5em;
        text-overflow: ellipsis;
        border-radius: 0 !important;
    }
    
    .my-table-row {
        display: table-row;
        text-align: left;

        &:hover {
            transition: 0.3s;
            background-color: var(--vscode-list-hoverBackground);
        }
    }
    .my-table-row-group{
        display: table-row-group;
        overflow-y:scroll;

        .my-table-row {
            border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
        }
    }

    .my-table-header-group{
        display: table-header-group;

        .my-table-header-row{
            background-color: var(--vscode-list-hoverBackground);
            color: var(--vscode-editor-foreground);
            margin: -.5rem;
            cursor: pointer;
            position: sticky;
            top: 0;

            .my-table-cell[sort=true] {
                font-weight: 400;
            }

            .my-table-cell[sort=true] {
                background-color: var(--vscode-button-background);
                border-radius: 5px;
            }
        }
    }
}
</style>

<script setup lang="ts">
import { computed } from "vue";

export interface MyTableField {
    key: string;
    title: string;
    width?: string;
    class?: string;
    sortable?: boolean;
}

const props = defineProps<{
    fields: Array<MyTableField>;
    items: Array<any>;
    sortby?: string;
    sortdesc?: boolean;
}>();


const emit = defineEmits(['rowclick', 'detailopen', 'sortchange', 'update:sortby', 'update:sortdesc']);


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


</script>
