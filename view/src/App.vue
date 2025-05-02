<template>

  <div class="elf-body" v-if="ready">
    <div class="elf-statistics">
      <MyStackChart :data=elfData @click="sectionUpdate">ELF section sizes</MyStackChart>
      <MyStackChart :data=sectionData @click="filterBy">{{ `Size of ${sectionView} section` }}</MyStackChart>
    </div>

    <div class="elf-data">

      <div class="elf-bar">
        <div>
          <MyButton @click="refresh">Reload</MyButton>
        </div>
        <input type="search" placeholder="Filter" v-model="filter" class="elf-filter vscode-input">
      </div>

      <div class="elf-symbols" ref="elf-symbols">

        <MyTable :fields="fields" v-model:sortby="sortBy" v-model:sortdesc="sortDesc" :items=itemsFiltered
          @sortchange="sortData">

          <template v-slot:address="address">
            {{ toHEX(address.data) }}
          </template>

          <template v-slot:size="size">
            {{ sizeToHEX(size.data) }}
          </template>

          <template v-slot:line="line">
            <a @click="elfStore.navigateTo(line.data)" class="elf-symbol-file">{{ filenameCut(line.data ?? "") }}</a>
          </template>

          <template v-slot:section="section">
            <span class="view-section">
              <span class="view-section-icon">
                <FontAwesomeIcon icon="fa-regular fa-eye" @click="sectionDataUpdate(section.data)" />
              </span>
              <span>{{ section.data }}</span>
            </span>
          </template>

        </MyTable>
      </div>
    </div>
  </div>

  <div class="elf-body" v-else> LOADING ... </div>

</template>


<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue';

import type { ElfElement } from '../../common/elfInfo';
import MyTable, { type MyTableField } from './components/general/MyTable.vue';
import MyButton from './components/general/MyButton.vue';
import MyStackChart, { type MyStackItem } from './components/general/MyStackChart.vue';

import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faEye } from '@fortawesome/free-regular-svg-icons';
library.add(faEye);


import { useElfStore } from './stores/elf';
const elfStore = useElfStore();


const fields: MyTableField[] = [
  // { sortable: false, class: "", key: "action", title: "" },
  { sortable: true, class: "", key: "name", title: "Name" },
  { sortable: true, class: "", key: "address", title: "Address" },
  { sortable: true, class: "", key: "size", title: "Size" },
  { sortable: true, class: "", key: "section", title: "Section" },
  { sortable: true, class: "", key: "line", title: "File" },
];

const filter = ref<string>("");


const sortBy = ref<string>('name');
const sortDesc = ref(false);
const items = ref<Array<ElfElement>>([]);


const toHEX = (val: number): string => `0x${val.toString(16).padStart(8, '0')}`;

const radix = ref(false);
const sizeToHEX = (val: number): string => {
  if (radix.value) return toHEX(val);
  return val.toString(10);
};

const itemsFiltered = computed(() =>
  items.value.filter(x =>
    filter.value?.length > 0
      ? (
        x.name?.includes(filter.value) ||
        toHEX(x.address).includes(filter.value) ||
        x.size?.toString().includes(filter.value) ||
        x.section?.includes(filter.value) ||
        x.line?.includes(filter.value)
      )
      : true
  )
);


const symbols = useTemplateRef("elf-symbols");

const sortData = async () => {
  items.value.sort((a: any, b: any) => {
    let cmp = 0;
    if (sortBy.value === 'address' || sortBy.value === 'size') {
      cmp = (a[sortBy.value] > b[sortBy.value]) ? 1
        : (a[sortBy.value] < b[sortBy.value]) ? -1
          : 0;
    }
    else {
      const cmpA: string = a[sortBy.value]?.toString() ?? "";
      const cmpB: string = b[sortBy.value]?.toString() ?? "";

      cmp = cmpA.localeCompare(cmpB);
    }

    if (sortDesc.value == false) cmp = cmp * -1;
    return cmp;
  }).sort((a: any, b: any) => {
    const cmpA: string = a[sortBy.value]?.toString() ?? "";
    const cmpB: string = b[sortBy.value]?.toString() ?? "";
    if (cmpB === "") return -1;
    if (cmpA === "") return 1;
    return 0;
  });

  symbols.value?.scrollTo(0, 0);
}


const sectionView = ref<string>('name');
const sectionData = ref<Array<MyStackItem>>([{ key: [], data: 0 }]);

const sectionDataUpdate = async (section: string) => {
  sectionView.value = section;
  const data = items.value
    .filter(x => x.section === section)
    .sort((a, b) => b.address - a.address)
    .map(x => ({ key: [x.name], data: x.size, meta: toHEX(x.address) }))
    .reduce((acc, item) => {
      let key = item.meta;
      if (acc[key] === undefined) acc[key] = {
        data: item.data,
        key: [...item.key],
        meta: item.meta,
      };
      else acc[key].key.push(...item.key);
      return acc;
    }, {} as Record<string, MyStackItem>);

  sectionData.value = Object.entries(data).map(([k, v]) => ({ ...v }));
};

const sectionUpdate = async (section: string) => {
  filterBy("");
  sectionDataUpdate(section);
}

const elfData = ref<Array<MyStackItem>>([{ key: [], data: 0, meta: "" }]);

const elfDataUpdate = async () => {
  const sections: Record<string, MyStackItem> = items.value
    .sort((a, b) => b.address - a.address)
    .map(x => ({ key: [x.section], data: x.size, meta: x.section }))
    .reduce((acc, item) => {
      let key = item.meta;

      if (acc[key] === undefined) acc[key] = {
        data: item.data,
        key: [...item.key],
        meta: item.meta,
      };
      else acc[key].data = acc[key].data + item.data;

      return acc;
    }, {} as Record<string, MyStackItem>);

  console.log(sections)

  elfData.value = Object.entries(sections).map(([k, v]) => ({ ...v }));
};


const filterBy = (data: string) => {
  filter.value = data;
}

const filenameCut = (filename: string): string => {
  if (filename.length < 48) return filename;
  return filename.substring(0, 10) + "..." + filename.slice(-36);
};


// const ready = ref<boolean>(true);
const ready = ref<boolean>(false);
const refresh = async () => {
  items.value = JSON.parse(elfStore.info).elements;
  sectionDataUpdate(items.value[0].section);
  elfDataUpdate();
  filterBy("");
  ready.value = true;
}

// refresh();

onMounted(async () => {
  await elfStore.updateElfInfo(refresh);
});




</script>


<style lang="scss">
.elf-body {
  width: 100%;
  display: flex;
  gap: 1rem;
  flex-direction: row;
}

.elf-statistics {
  display: flex;
  flex-direction: row;
  gap: 1rem;
  background-color: var(--vscode-sideBar-background);
  border-radius: 10px;
  padding: 1rem;

  .my-stack-chart {
    width: 25px;
  }

  .my-chart-title {
    font-size: 1.2rem;
  }
}

.view-section {
  flex-direction: row;
  align-items: center;
  display: flex;
  gap: .5rem;

  .view-section-icon {
    cursor: pointer;
    padding: .5rem;
    margin: -.5rem;

    &:hover {
      transition: 0.3s;
      color: var(--vscode-button-background);
    }
  }
}


.vscode-input {
  background-color: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border, transparent);
  color: var(--vscode-input-foreground);
  border-radius: 2px;
  padding: .5rem;
  outline: none;

  &:focus {
    border: 1px solid var(--vscode-inputOption-activeBorder, transparent);
  }
}


.elf-symbol-file {
  cursor: pointer;
}


.elf-data {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: .5rem;


  .elf-bar {
    display: flex;
    justify-content: space-between;
    gap: .5rem;


    .elf-filter {
      width: 300px;

      position: sticky;
      right: 0;
    }
  }
}


.elf-symbols {
  height: 90dvh;
  background-color: var(--vscode-sideBar-background);
  padding: 1rem;
  border-radius: 10px;
  overflow-y: auto;
  overflow-x: auto;
}
</style>