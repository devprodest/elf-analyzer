<template>
  <div class="elf-body" v-if="ready">
    <!-- Статистика и Графики -->
    <div class="elf-statistics">
      <div class="elf-stats-charts">
        <MyStackChart :data=elfData @click="sectionUpdate">ELF section sizes</MyStackChart>
        <MyStackChart :data=sectionData @click="filterBy">{{ `Size of ${sectionView} section` }}</MyStackChart>
      </div>

      <!-- Панель Top-15 -->
      <div class="elf-stats-info">
        <div class="elf-stats-block elf-top-symbols">
          <div class="elf-stats-title">Top 15 Symbols</div>
          <div class="elf-top-symbol-row" v-for="sym in topSymbols" :key="sym.address" @click="filter = sym.name"
            title="Click to filter">
            <span class="elf-top-name">{{ sym.name }}</span>
            <span class="elf-top-size">{{ formatBytes(sym.size) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="elf-data">
      <!-- Тулбар -->
      <div class="elf-bar">
        <!-- Левая часть -->
        <div class="elf-bar-left">
          <MyButton @click="reload">Reload</MyButton>
        </div>

        <!-- Центральная часть -->
        <div class="elf-bar-center">
          <span class="elf-total">Total: {{ itemsFiltered.length }} items, {{ totalFilteredSize }} bytes</span>
        </div>

        <!-- Правая часть -->
        <div class="elf-bar-right">
          <MySegmentedControl v-model="groupBy" :options="groupByOptions" />
          <MySegmentedControl v-model="radix" :options="radixOptions" />
          <input type="search" placeholder="Filter" v-model="filter" class="elf-filter vscode-input">
        </div>
      </div>

      <div class="elf-symbols" ref="elf-symbols">
        <MyTable :fields="fields" v-model:sortby="sortBy" v-model:sortdesc="sortDesc" :items=displayedRows
          @sortchange="sortData" @togglegroup="toggleGroup">

          <template v-slot:address="address">
            <pre>{{ toHEX(address.data) }}</pre>
          </template>

          <template v-slot:size="size">
            {{ sizeToHexOrDec(size.data) }}
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

  <div class="elf-body elf-error" v-else-if="error">
    <div>
      <p><strong>Failed to load ELF info</strong></p>
      <pre class="elf-error-message">{{ error }}</pre>
      <MyButton @click="reload">Retry</MyButton>
    </div>
  </div>

  <div class="elf-body" v-else> LOADING ... </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue';

import type { ElfElement, ElfInfo } from '../../common/elfInfo';
import MyTable, { type MyTableField, type TableRow } from './components/general/MyTable.vue';
import MyButton from './components/general/MyButton.vue';
import MyStackChart, { type MyStackItem } from './components/general/MyStackChart.vue';
import MySegmentedControl, { type SegmentedOption } from './components/general/MySegmentedControl.vue';

import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faEye } from '@fortawesome/free-regular-svg-icons';
library.add(faEye);

import { useElfStore } from './stores/elf';
const elfStore = useElfStore();

const fields: MyTableField[] = [
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

const radix = ref<string>('dec');
const radixOptions: SegmentedOption[] = [
  { value: 'dec', label: 'Dec' },
  { value: 'hex', label: 'Hex' },
];

// --- ГРУППИРОВКА ---
const collapsedGroups = ref<Set<string>>(new Set());

const groupBy = ref<string>('none');

const groupByOptions: SegmentedOption[] = [
  { value: 'none', label: 'None' },
  { value: 'section', label: 'Section' },
  { value: 'file', label: 'File' },
];

const toggleGroup = (key: string) => {
  if (collapsedGroups.value.has(key)) {
    collapsedGroups.value.delete(key);
  } else {
    collapsedGroups.value.add(key);
  }
  collapsedGroups.value = new Set(collapsedGroups.value);
};

const toHEX = (val: number | undefined | null): string => {
  if (val === undefined || val === null || isNaN(val)) return "";
  return `0x${val.toString(16).padStart(8, '0')}`;
};

const sizeToHexOrDec = (val: number | undefined | null): string => {
  if (val === undefined || val === null || isNaN(val)) return "";
  return radix.value === 'hex' ? toHEX(val) : val.toString(10);
};

const itemsFiltered = computed(() => {
  const q = filter.value.trim().toLowerCase();
  if (!q) return items.value;

  return items.value.filter(x =>
    x.name?.toLowerCase().includes(q) ||
    toHEX(x.address).toLowerCase().includes(q) ||
    x.size?.toString().includes(q) ||
    x.section?.toLowerCase().includes(q) ||
    x.line?.toLowerCase().includes(q)
  );
});

const totalFilteredSize = computed(() => {
  return itemsFiltered.value.reduce((sum, item) => sum + (item.size || 0), 0);
});

// Форматирование байт в KB/MB
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Топ-15 символов
const topSymbols = computed(() => {
  return [...itemsFiltered.value]
    .filter(x => x.size > 0)
    .sort((a, b) => b.size - a.size)
    .slice(0, 15);
});

// Вычисляем строки для таблицы (с группами или без)
const displayedRows = computed<TableRow[]>(() => {
  if (groupBy.value === 'none') {
    return itemsFiltered.value.map(item => ({ isGroup: false, item } as TableRow));
  }

  const groups: Record<string, { count: number; totalSize: number; items: ElfElement[] }> = {};

  for (const item of itemsFiltered.value) {
    let key = "";
    if (groupBy.value === 'section') {
      key = item.section || "(no section)";
    } else if (groupBy.value === 'file') {
      const match = item.line?.match(/(.*):\d+$/);
      key = match ? match[1] : (item.line || "(no file)");
    }

    if (!groups[key]) groups[key] = { count: 0, totalSize: 0, items: [] };
    groups[key].count++;
    groups[key].totalSize += (item.size || 0);
    groups[key].items.push(item);
  }

  const sortedGroups = Object.entries(groups).sort((a, b) => b[1].totalSize - a[1].totalSize);

  const result: TableRow[] = [];
  for (const [key, group] of sortedGroups) {
    result.push({
      isGroup: true,
      key,
      title: key,
      count: group.count,
      totalSize: group.totalSize,
      collapsed: collapsedGroups.value.has(key)
    });

    if (!collapsedGroups.value.has(key)) {
      for (const item of group.items) {
        result.push({ isGroup: false, item } as TableRow);
      }
    }
  }
  return result;
});

const symbols = useTemplateRef("elf-symbols");

const sortData = () => {
  const sb = sortBy.value;
  const sd = sortDesc.value;

  items.value.sort((a: any, b: any) => {
    const valA = a[sb];
    const valB = b[sb];

    const isEmptyA = valA === undefined || valA === null || valA === "";
    const isEmptyB = valB === undefined || valB === null || valB === "";
    if (isEmptyA && !isEmptyB) return 1;
    if (!isEmptyA && isEmptyB) return -1;
    if (isEmptyA && isEmptyB) return 0;

    let cmp = 0;
    if (sb === 'address' || sb === 'size') {
      cmp = valA - valB;
    } else {
      cmp = valA.toString().localeCompare(valB.toString());
    }

    return sd ? -cmp : cmp;
  });

  symbols.value?.scrollTo(0, 0);
};

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

  elfData.value = Object.entries(sections).map(([k, v]) => ({ ...v }));
};

const filterBy = (data: string) => {
  filter.value = data;
}

const filenameCut = (filename: string): string => {
  if (filename.length < 48) return filename;
  return filename.substring(0, 10) + "..." + filename.slice(-36);
};

const ready = ref<boolean>(false);
const error = ref<string>("");

const refresh = async () => {
  try {
    const parsed = JSON.parse(elfStore.info) as ElfInfo | null;

    if (!parsed || !Array.isArray(parsed.elements)) {
      error.value = "Invalid ELF info received from extension host";
      ready.value = false;
      return;
    }

    if (parsed.error) {
      error.value = parsed.error;
      ready.value = false;
      return;
    }

    error.value = "";
    items.value = parsed.elements;

    if (items.value.length > 0) {
      sectionDataUpdate(items.value[0]?.section ?? "");
    }
    elfDataUpdate();
    filterBy("");
    ready.value = true;
    sortData();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    ready.value = false;
  }
};

const reload = async () => {
  error.value = "";
  ready.value = false;
  await elfStore.updateElfInfo(refresh);
};

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
  height: fit-content;
  max-height: 90dvh;
  overflow-y: auto;

  .elf-stats-charts {
    display: flex;
    flex-direction: row;
    gap: 1rem;

    .my-stack-chart {
      width: 25px;
    }

    .my-chart-title {
      font-size: 1.2rem;
    }
  }

  .elf-stats-info {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    border-left: 1px solid var(--vscode-sideBarSectionHeader-border);
    padding-left: 1rem;
    min-width: 200px;
    max-width: 250px;

    .elf-stats-block {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .elf-stats-title {
      font-size: 0.9rem;
      font-weight: bold;
      color: var(--vscode-editor-foreground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.2rem;
    }

    .elf-top-symbols {
      .elf-top-symbol-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.85rem;
        padding: 0.2rem 0.4rem;
        border-radius: 4px;
        cursor: pointer;

        &:hover {
          background-color: var(--vscode-list-hoverBackground);
        }

        .elf-top-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 150px;
          color: var(--vscode-textLink-foreground);
        }

        .elf-top-size {
          color: var(--vscode-descriptionForeground);
          white-space: nowrap;
        }
      }
    }
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
    align-items: center;
    gap: 1rem;

    .elf-bar-left,
    .elf-bar-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
    }

    .elf-bar-right {
      justify-content: flex-end;
    }

    .elf-bar-center {
      display: flex;
      justify-content: center;
      white-space: nowrap;

      .elf-total {
        font-size: 0.9rem;
        color: var(--vscode-descriptionForeground);
        font-weight: 500;
      }
    }

    .elf-filter {
      width: 250px;
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

.elf-error {
  box-sizing: border-box;
  flex-direction: column;
  align-items: stretch;
  padding: 1rem;
  background-color: var(--vscode-inputValidation-errorBackground);
  border: 1px solid var(--vscode-inputValidation-errorBorder);
  border-radius: 10px;

  >div {
    min-width: 0;
    max-width: 100%;
  }

  .elf-error-message {
    box-sizing: border-box;
    max-width: 100%;
    white-space: pre-wrap;
    word-break: break-all;
    overflow-wrap: anywhere;
    margin: 0.5rem 0;
    color: var(--vscode-errorForeground);
    font-family: var(--vscode-editor-font-family);
    font-size: 0.85rem;
  }

  .my-button {
    align-self: flex-start;
  }
}
</style>