<template>

  <div class="elf-body" v-if="ready">
    <div class="elf-statistics">
      <MyDoughnutChart title="ELF section sizes" :data=elfData></MyDoughnutChart>
      <MyDoughnutChart :title="`Size of ${sectionView} section`" :data=sectionData></MyDoughnutChart>
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
            0x{{ address.data.toString(16).padStart(8, '0') }}
          </template>

          <template v-slot:size="size">
            {{ toHEX(size.data) }}
          </template>

          <template v-slot:line="line">
            <a @click="elfStore.navigateTo(line.data)" class="elf-symbol-file">{{ filenameCut(line.data ?? "") }}</a>
          </template>

          <template v-slot:section="section">
            <span class="view-section">
              <span class="view-section-icon"><font-awesome-icon icon="fa-regular fa-eye"
                  @click="sectionDataUpdate(section.data)" /></span>
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
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';
import { useElfStore } from './stores/elf';

import MyTable from './components/general/MyTable.vue';
import MyButton from './components/general/MyButton.vue';
import type { MyTableField } from './components/general/MyTable.vue';
import type { ElfElement } from '../../common/elfInfo';
import MyDoughnutChart, { type MyDoughnutItem } from './components/general/MyDoughnutChart.vue';

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

const radix = ref(false);
const toHEX = (val: number): string => {
  if (radix.value) return `0x${val.toString(16).padStart(8, '0')}`
  return val.toString(10);
};

const itemsFiltered = computed(() =>
  items.value.filter(x =>
    filter.value?.length > 0
      ? (x.name?.includes(filter.value) || x.address?.toString().includes(filter.value) || x.size?.toString().includes(filter.value) || x.section?.includes(filter.value) || x.line?.includes(filter.value))
      : true
  )
)



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
const sectionData = ref<Array<MyDoughnutItem>>([{ key: "None", data: 0 }]);
const sectionDataUpdate = (section: string) => {
  sectionView.value = section;
  const data = items.value
    .filter(x => x.section === section)
    .map(x => ({ key: x.name, data: x.size }))
    .sort((a, b) => b.data - a.data);
  sectionData.value = data.splice(0, 10);

  const other = data.splice(10).reduce((s, x) => s + x.data, 0);
  if (other < sectionData.value[0].data) { sectionData.value.push({ key: "other", data: other }); }

};


const elfData = ref<Array<MyDoughnutItem>>([{ key: "None", data: 10 }]);
const elfDataUpdate = () => {
  const sections: Record<string, number> = items.value.reduce((acc, item) => {
    let key = item.section;
    acc[key] = (acc[key] || 0) + item.size;
    return acc;
  }, {} as Record<string, number>);

  elfData.value = Object.keys(sections)
    .map(x => {
      let key = x;
      return { key: x, data: sections[key] }
    }
    )
    .sort((a, b) => a.data - b.data)
    .filter(x => x.data !== 0);
};


const filenameCut = (filename: string): string => {
  if (filename.length < 48) return filename;
  return filename.substring(0, 10) + "..." + filename.slice(-36);
};


const ready = ref<boolean>(false);
const refresh = async () => {
  items.value = JSON.parse(elfStore.info).elements;
  sectionDataUpdate(items.value[0].section);
  elfDataUpdate();

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
  flex-direction: column;
  gap: 1rem;

  >div {
    display: flex;
    flex-direction: column;
    padding: 1rem;
    background-color: var(--vscode-sideBar-background);
    border-radius: 10px;
    align-items: center
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