<template>
    <table class="my-table">
        <thead>
            <tr class="my-table-header">
                <th class="my-table-header-cell" :class="head.class" :width="head.width" v-for="head in fields"
                    :key="head.key" :sort="sortby === head.key" @click="sort(head)">
                    {{ head.title }}
                </th>
            </tr>
        </thead>

        <tbody>
            <tr class="my-table-row" v-for="(item, i) in items" :key="i" @click.stop.prevent="onRowClick(item)">
                <td class="my-table-cell" v-for="g in fields" :key="g.key" >
                    <slot :name="g.key" :data="item[g.key]" :item="item" :key="item">
                        {{ item[g.key] }}
                    </slot>
                </td>
            </tr>
        </tbody>
    </table>
</template>


line-height: 22px; background-color: var(--vscode-sideBarSectionHeader-background); border-top: 1px solid var(--vscode-sideBarSectionHeader-border); color: var(--vscode-sideBarSectionHeader-foreground);



<style lang="scss">
.my-table {
    width: 100%;
    border-collapse: collapse;

    td, th {
        padding: .5em;
    }

    tr {
        text-align: left;
    }

    >tbody tr{
        border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
    }

    tr:hover {
        transition: 0.3s;
        background-color: var(--vscode-list-hoverBackground);
    }

    .my-table-header th[sort=true] {
        background-color: var(--vscode-button-background);
    }
    
    .my-table-header{
        background-color: var(--vscode-sideBarSectionHeader-background);
        color: var(--vscode-editor-foreground);
        position: sticky;
        top: 0;
    }

    .my-table-header {
        cursor: pointer;
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
