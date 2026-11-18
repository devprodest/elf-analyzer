<template>
  <!-- ОСНОВНОЙ LAYOUT -->
  <div class="elf-layout" v-if="ready">

    <!-- ВЕРХНИЙ ТУЛБАР (на всю ширину) -->
    <div class="elf-bar">
      <div class="elf-bar-left">
        <MyButton @click="reload" v-tooltip="'Reload ELF info'">
          <FontAwesomeIcon :icon="faRotateRight" /><span>RELOAD</span>
        </MyButton>
        <MyButton @click="exportCsv" v-tooltip="'Export filtered table to CSV'">
          <FontAwesomeIcon :icon="faFileCsv" />
        </MyButton>
        <MyButton @click="startCompare" v-tooltip="'Compare with another ELF file'">
          <FontAwesomeIcon :icon="faCodeCompare" />
        </MyButton>
      </div>

      <div class="elf-bar-center">
        <span class="elf-total" title="Visible items and total size">Total: {{ itemsFiltered.length }} items, {{
          totalFilteredSize }} bytes</span>
      </div>

      <div class="elf-bar-right">
        <MyButton v-if="groupBy !== 'none'" @click="toggleAllGroups"
          v-tooltip="allGroupsCollapsed ? 'Expand All' : 'Collapse All'">
          <FontAwesomeIcon :icon="allGroupsCollapsed ? faAnglesDown : faAnglesUp" />
        </MyButton>
        <MySegmentedControl v-model="groupBy" :options="groupByOptions" />
        <MySegmentedControl v-model="typeFilter" :options="typeOptions" />
        <MySegmentedControl v-model="radix" :options="radixOptions" />

        <MyButton @click="hideEmpty = !hideEmpty"
          v-tooltip="hideEmpty ? 'Show symbols with size 0' : 'Hide symbols with size 0'" :active="hideEmpty">
          <FontAwesomeIcon :icon="hideEmpty ? faEyeSlash : faEye" />
        </MyButton>

        <div class="elf-search-wrapper">
          <input type="search" placeholder="Filter" v-model="filter" class="vscode-input">
          <div class="elf-search-actions">
            <div class="elf-search-icon" :class="{ active: useRegex }" @click="useRegex = !useRegex"
              v-tooltip="'Use Regular Expressions'">
              <FontAwesomeIcon :icon="faCode" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- НИЖНЯЯ ЧАСТЬ (Графики + Таблица) -->
    <div class="elf-content">
      <!-- Левая панель: Графики и Топ-15 -->
      <div class="elf-statistics">
        <div class="elf-stats-charts">
          <MyStackChart :data=elfData @click="sectionUpdate">ELF section sizes</MyStackChart>
          <MyStackChart :data=sectionData @click="filterBy">{{ `Size of ${sectionView} section` }}</MyStackChart>
        </div>

        <div class="elf-stats-info">
          <div class="elf-stats-block elf-top-symbols">
            <div class="elf-stats-title">
              Top 15 Symbols
              <span v-if="selectedSection" class="elf-top-section-name">({{ selectedSection }})</span>
            </div>
            <div class="elf-top-symbol-row" v-for="sym in topSymbols" :key="sym.address" @click="filter = sym.name"
              title="Click to filter">
              <span class="elf-top-name">{{ sym.name }}</span>
              <span class="elf-top-size">{{ formatBytes(sym.size) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Правая панель: Таблица -->
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
                <FontAwesomeIcon :icon="faEye" @click="sectionDataUpdate(section.data)" />
              </span>
              <span>{{ section.data }}</span>
            </span>
          </template>
        </MyTable>
      </div>
    </div>
  </div>

  <!-- СОСТОЯНИЯ ОШИБКИ / ЗАГРУЗКИ -->
  <div class="elf-body elf-error" v-else-if="error">
    <div>
      <p><strong>Failed to load ELF info</strong></p>
      <pre class="elf-error-message">{{ error }}</pre>
      <MyButton @click="reload" v-tooltip="'Retry'">
        <FontAwesomeIcon :icon="faRotate" /> RELOAD
      </MyButton>
    </div>
  </div>

  <div class="elf-body" v-else> LOADING ... </div>

  <!-- МОДАЛКА DIFF -->
  <div class="elf-modal-overlay" v-if="diffData" @click.self="diffData = null">
    <div class="elf-modal">
      <div class="elf-modal-header">
        <h3>Diff Result</h3>
        <div class="elf-modal-actions">
          <MyButton @click="copyDiffToClipboard" v-tooltip="'Copy to Clipboard'">
            <FontAwesomeIcon :icon="faCopy" />
          </MyButton>
          <MyButton @click="exportDiffCsv" v-tooltip="'Export to CSV'">
            <FontAwesomeIcon :icon="faFileCsv" />
          </MyButton>
          <MyButton @click="diffData = null" v-tooltip="'Close'">
            <FontAwesomeIcon :icon="faXmark" />
          </MyButton>
        </div>
      </div>

      <div class="elf-modal-body">
        <div class="elf-diff-summary">
          <p>Total Size Change:
            <strong
              :style="{ color: diffData.sizeDiff > 0 ? 'var(--vscode-gitDecoration-deletedResourceForeground)' : 'var(--vscode-gitDecoration-addedResourceForeground)' }">
              {{ diffData.sizeDiff > 0 ? '+' : '' }}{{ diffData.sizeDiff }} bytes
            </strong>
          </p>
        </div>

        <div class="elf-diff-list">
          <div class="elf-diff-item elf-diff-header">
            <span class="elf-diff-name">Name</span>
            <span class="elf-diff-size">Diff (bytes)</span>
            <span class="elf-diff-old">Old &rarr; New</span>
          </div>

          <div class="elf-diff-item" v-for="item in sortedDiffItems" :key="item.name">
            <span class="elf-diff-name">{{ item.name }}</span>
            <span class="elf-diff-size"
              :class="item.diff > 0 ? 'diff-plus' : (item.diff < 0 ? 'diff-minus' : 'diff-zero')">
              {{ item.diff > 0 ? '+' : '' }}{{ item.diff }}
            </span>
            <span class="elf-diff-old">{{ item.oldSize }} &rarr; {{ item.newSize }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';
import { useEventListener } from '@vueuse/core';

import type { ElfElement, ElfInfo } from '../../common/elfInfo';
import MyTable, { type MyTableField, type TableRow } from './components/general/MyTable.vue';
import MyButton from './components/general/MyButton.vue';
import MySegmentedControl, { type SegmentedOption } from './components/general/MySegmentedControl.vue';
import MyStackChart, { type MyStackItem } from './components/general/MyStackChart.vue';
import { sendMessage } from '../../common/utils';

import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faEye, faEyeSlash, faCode, faAnglesDown, faAnglesUp, faRotateRight, faFileCsv, faCodeCompare, faCopy, faXmark, faRotate, faList, faFolderTree, faFileCode, faCubes, faSquareRootVariable, faDatabase, faQuestion, fa1, faHashtag } from '@fortawesome/free-solid-svg-icons';

const getState = <T,>(): T | undefined => {
  // @ts-ignore
  return vscode.getState() as T | undefined;
};

const setState = (state: any) => {
  // @ts-ignore
  vscode.setState(state);
};

import { useElfStore } from './stores/elf';
const elfStore = useElfStore();

const fields: MyTableField[] = [
  { sortable: true, class: "", key: "name", title: "Name" },
  { sortable: true, class: "", key: "address", title: "Address" },
  { sortable: true, class: "", key: "size", title: "Size" },
  { sortable: true, class: "", key: "section", title: "Section" },
  { sortable: true, class: "", key: "line", title: "File" },
];

const defaultState = {
  filter: "",
  sortBy: "name",
  sortDesc: false,
  groupBy: "none",
  radix: "dec",
  typeFilter: "all",
  collapsedGroups: [] as string[],
  hideEmpty: false,
  useRegex: false,
};

const savedState = getState<typeof defaultState>() || defaultState;


const filter = ref<string>(savedState.filter);
const typeFilter = ref<string>(savedState.typeFilter);
const sortBy = ref<string>(savedState.sortBy);
const sortDesc = ref<boolean>(savedState.sortDesc);
const groupBy = ref<string>(savedState.groupBy);
const radix = ref<string>(savedState.radix);
const collapsedGroups = ref<Set<string>>(new Set(savedState.collapsedGroups));
const hideEmpty = ref<boolean>(savedState.hideEmpty);
const useRegex = ref<boolean>(savedState.useRegex);

const saveState = () => {
  setState({
    filter: filter.value,
    sortBy: sortBy.value,
    sortDesc: sortDesc.value,
    groupBy: groupBy.value,
    radix: radix.value,
    typeFilter: typeFilter.value,
    collapsedGroups: Array.from(collapsedGroups.value),
    hideEmpty: hideEmpty.value,
    useRegex: useRegex.value,
  });
};

watch([filter, sortBy, sortDesc, groupBy, radix, typeFilter, hideEmpty, useRegex], saveState);
watch(collapsedGroups, saveState, { deep: true });


const groupByOptions: SegmentedOption[] = [
  { value: 'none', label: "NONE", tooltip: 'None' },
  { value: 'section', label: "SECTION", tooltip: 'Group by Section' },
  { value: 'file', label: "FILE", tooltip: 'Group by File' },
];

const typeOptions: SegmentedOption[] = [
  { value: 'all', label: "ALL", tooltip: 'All Types' },
  { value: 'func', label: "FUNC", tooltip: 'Functions only' },
  { value: 'object', label: "OBJ", tooltip: 'Objects only' },
  { value: 'other', label: "OTHER", tooltip: 'Other types' },
];

const radixOptions: SegmentedOption[] = [
  { value: 'dec', label: "10", tooltip: 'Decimal' },
  { value: 'hex', label: "0x", tooltip: 'Hexadecimal' },
];

const items = ref<Array<ElfElement>>([]);

const toggleGroup = (key: string) => {
  if (collapsedGroups.value.has(key)) {
    collapsedGroups.value.delete(key);
  } else {
    collapsedGroups.value.add(key);
  }
  collapsedGroups.value = new Set(collapsedGroups.value);
};

// Проверяем, все ли группы сейчас свернуты
const allGroupsCollapsed = computed(() => {
  if (groupBy.value === 'none') return false;

  // Получаем список уникальных ключей групп
  const groups = new Set<string>();
  for (const item of itemsFiltered.value) {
    if (groupBy.value === 'section') groups.add(item.section || "(no section)");
    else if (groupBy.value === 'file') {
      const match = item.line?.match(/(.*):\d+$/);
      groups.add(match ? match[1] : (item.line || "(no file)"));
    }
  }

  // Если все группы есть в collapsedGroups, значит они все свернуты
  return groups.size > 0 && Array.from(groups).every(k => collapsedGroups.value.has(k));
});

// Сворачиваем или разворачиваем всё
const toggleAllGroups = () => {
  if (groupBy.value === 'none') return;

  if (allGroupsCollapsed.value) {
    // Разворачиваем всё
    collapsedGroups.value.clear();
  } else {
    // Сворачиваем всё
    for (const item of itemsFiltered.value) {
      let key = "";
      if (groupBy.value === 'section') {
        key = item.section || "(no section)";
      } else if (groupBy.value === 'file') {
        const match = item.line?.match(/(.*):\d+$/);
        key = match ? match[1] : (item.line || "(no file)");
      }
      collapsedGroups.value.add(key);
    }
  }
  // Триггерим реактивность для Set
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
  let result = items.value;

  if (hideEmpty.value) {
    result = result.filter(x => x.size > 0);
  }

  if (typeFilter.value !== 'all') {
    result = result.filter(x => {
      const type = x.type?.toUpperCase() || '';
      if (typeFilter.value === 'func') return type === 'FUNC';
      if (typeFilter.value === 'object') return type === 'OBJECT';
      if (typeFilter.value === 'other') return type !== 'FUNC' && type !== 'OBJECT';
      return true;
    });
  }

  const q = filter.value.trim();
  if (!q) return result;

  if (useRegex.value) {
    try {
      const re = new RegExp(q, 'i');
      return result.filter(x =>
        re.test(x.name) ||
        re.test(toHEX(x.address)) ||
        re.test(x.size?.toString() || "") ||
        re.test(x.section) ||
        re.test(x.line || "")
      );
    } catch (e) {
      return [];
    }
  }

  const qLower = q.toLowerCase();
  return result.filter(x =>
    x.name?.toLowerCase().includes(qLower) ||
    toHEX(x.address).toLowerCase().includes(qLower) ||
    x.size?.toString().includes(qLower) ||
    x.section?.toLowerCase().includes(qLower) ||
    x.line?.toLowerCase().includes(qLower)
  );
});

const totalFilteredSize = computed(() => {
  return itemsFiltered.value.reduce((sum, item) => sum + (item.size || 0), 0);
});

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Топ-15 символов (зависит от выбранной секции)
const topSymbols = computed(() => {
  let sourceItems = itemsFiltered.value;

  // Фильтруем только если выбрана конкретная секция
  if (selectedSection.value) {
    sourceItems = sourceItems.filter(x => x.section === selectedSection.value);
  }

  return [...sourceItems]
    .filter(x => x.size > 0)
    .sort((a, b) => b.size - a.size)
    .slice(0, 15);
});

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

const sectionView = ref<string>('');
const selectedSection = ref<string>('');
const sectionData = ref<Array<MyStackItem>>([{ key: [], data: 0 }]);

const sectionDataUpdate = async (section: string) => {
  sectionView.value = section;
  selectedSection.value = section;
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
  selectedSection.value = '';
  sectionView.value = section; // Устанавливаем выбранную секцию
  sectionDataUpdate(section);
};

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
      const firstSection = items.value[0]?.section || 'text';
      sectionView.value = firstSection;
      sectionDataUpdate(firstSection);
    }

    selectedSection.value = '';
    elfDataUpdate();
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

// --- CSV EXPORT ---
const exportCsv = () => {
  const data = itemsFiltered.value;
  if (data.length === 0) return;

  const headers = ['Name', 'Address', 'Size', 'Section', 'File/Line'];

  const escapeCsv = (val: string | number | undefined) => {
    if (val === undefined || val === null) return '""';
    const str = val.toString();
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = data.map(item => [
    escapeCsv(item.name),
    escapeCsv(toHEX(item.address)),
    escapeCsv(item.size),
    escapeCsv(item.section),
    escapeCsv(item.line)
  ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\n');
  sendMessage({ type: 'export-csv', value: csvContent });
};

// --- DIFF ---
const diffData = ref<{ sizeDiff: number; items: Array<{ name: string; oldSize: number; newSize: number; diff: number }> } | null>(null);

const sortedDiffItems = computed(() => {
  if (!diffData.value) return [];
  return [...diffData.value.items].sort((a, b) => b.diff - a.diff);
});

const startCompare = () => {
  sendMessage({ type: 'compare-elf' });
};

useEventListener(window, 'message', (event: any) => {
  const message = event.data;
  if (message.type === 'compare-result') {
    const oldInfo = JSON.parse(message.value) as ElfInfo;
    if (oldInfo && oldInfo.elements) {
      calculateDiff(oldInfo.elements);
    }
  }
});

const calculateDiff = (oldElements: ElfElement[]) => {
  const oldMap = new Map<string, ElfElement>();
  for (const el of oldElements) {
    oldMap.set(el.name, el);
  }

  const newElements = items.value;
  const diffItems: Array<{ name: string; oldSize: number; newSize: number; diff: number }> = [];
  let totalSizeDiff = 0;

  for (const newEl of newElements) {
    const oldEl = oldMap.get(newEl.name);
    const oldSize = oldEl ? oldEl.size : 0;
    const diff = newEl.size - oldSize;

    if (diff !== 0) {
      diffItems.push({
        name: newEl.name,
        oldSize,
        newSize: newEl.size,
        diff
      });
      totalSizeDiff += diff;
    }
    oldMap.delete(newEl.name);
  }

  for (const [name, el] of oldMap) {
    diffItems.push({
      name,
      oldSize: el.size,
      newSize: 0,
      diff: -el.size
    });
    totalSizeDiff -= el.size;
  }

  diffData.value = {
    sizeDiff: totalSizeDiff,
    items: diffItems
  };
};

const copyDiffToClipboard = () => {
  if (!diffData.value) return;

  const header = "Name\tDiff\tOld -> New";
  const rows = sortedDiffItems.value.map(item =>
    `${item.name}\t${item.diff > 0 ? '+' : ''}${item.diff}\t${item.oldSize} -> ${item.newSize}`
  ).join('\n');

  const text = `Total Size Change: ${diffData.value.sizeDiff} bytes\n\n${header}\n${rows}`;

  navigator.clipboard.writeText(text);
};

const exportDiffCsv = () => {
  if (!diffData.value) return;

  const headers = ['Name', 'Diff', 'Old Size', 'New Size'];
  const rows = sortedDiffItems.value.map(item => [
    `"${item.name}"`,
    item.diff,
    item.oldSize,
    item.newSize
  ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\n');
  sendMessage({ type: 'export-csv', value: csvContent });
};

onMounted(async () => {
  await elfStore.updateElfInfo(refresh);
});
</script>

<style lang="scss">
/* --- ОСНОВНОЙ LAYOUT --- */
.elf-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  padding: 0.5rem;
  box-sizing: border-box;
  gap: 0.5rem;
  overflow: hidden;
}

/* --- ТУЛБАР (ВЕРХНИЙ) --- */
.elf-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  width: 100%;
  white-space: nowrap;
  flex-shrink: 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);

  .elf-bar-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .elf-bar-center {
    display: flex;
    justify-content: center;
    white-space: nowrap;
    flex: 1;

    @media (max-width: 1100px) {
      display: none !important;
    }

    .elf-total {
      font-size: 0.9rem;
      color: var(--vscode-descriptionForeground);
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .elf-bar-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;

    .my-button {
      padding: 0.4rem 0.6rem;
      font-size: 0.85rem;
    }
  }

  .elf-search-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    width: 16rem; /* 256px */
    flex-shrink: 0;

    input.vscode-input {
      width: 100%;
      padding-right: 2.5rem;
    }

    .elf-search-actions {
      position: absolute;
      right: 0.4rem;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      gap: 0.4rem;
      align-items: center;
      pointer-events: none;

      .elf-search-icon {
        pointer-events: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1.4rem; /* 22px */
        height: 1.4rem;
        border-radius: 0.2rem;
        font-size: 0.85rem;
        color: var(--vscode-editor-foreground);
        opacity: 0.7;
        transition: all 0.2s;

        &:hover {
          background-color: var(--vscode-toolbar-hoverBackground);
          opacity: 1;
        }

        &.active {
          color: var(--vscode-button-foreground);
          background-color: var(--vscode-button-background);
          opacity: 1;
        }
      }
    }
  }
}

/* --- НИЖНЯЯ ЧАСТЬ (Контент) --- */
.elf-content {
  flex: 1;
  display: flex;
  flex-direction: row;
  gap: 1rem;
  min-height: 0;
  overflow: hidden;
}

/* --- ЛЕВАЯ ПАНЕЛЬ (СТАТИСТИКА) --- */
.elf-statistics {
  display: flex;
  flex-direction: row;
  gap: 1rem;
  background-color: var(--vscode-sideBar-background);
  border-radius: 0.6rem;
  padding: 1rem;
  height: 100%;
  box-sizing: border-box;
  flex-shrink: 0;
  width: fit-content;

  @media (max-width: 1000px) {
    .elf-stats-info {
      display: none !important;
    }
  }

  @media (max-width: 800px) {
    display: none !important;
  }

  .elf-stats-charts {
    display: flex;
    flex-direction: row;
    gap: 1rem;
    height: 100%;
    flex-shrink: 0;
    min-width: 5rem;
  }

  .elf-stats-info {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    border-left: 1px solid var(--vscode-sideBarSectionHeader-border);
    padding-left: 1rem;
    width: 15.5rem; /* 250px */
    flex-shrink: 0;

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

      .elf-top-section-name {
        color: var(--vscode-textLink-foreground);
        text-transform: none;
        font-weight: normal;
        margin-left: 0.5rem;
      }
    }

    .elf-top-symbols {
      .elf-top-symbol-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.85rem;
        padding: 0.2rem 0.4rem;
        border-radius: 0.2rem;
        cursor: pointer;

        &:hover {
          background-color: var(--vscode-list-hoverBackground);
        }

        .elf-top-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 9rem;
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

/* --- ПРАВАЯ ПАНЕЛЬ (ТАБЛИЦА) --- */
.elf-symbols {
  flex: 1;
  background-color: var(--vscode-sideBar-background);
  padding: 1rem;
  border-radius: 0.6rem;
  overflow: auto;
  position: relative;
  min-width: 0;
}

/* --- ЭЛЕМЕНТЫ ТАБЛИЦЫ --- */
.view-section {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;

  .view-section-icon {
    padding: 0.5rem;
    margin: -0.5rem;
    cursor: pointer;

    &:hover {
      transition: 0.3s;
      color: var(--vscode-button-background);
    }
  }
}

.elf-symbol-file {
  color: var(--vscode-textLink-foreground);
  text-decoration: none;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

/* --- ИНПУТЫ --- */
.vscode-input {
  background-color: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border, transparent);
  color: var(--vscode-input-foreground);
  border-radius: 0.2rem;
  padding: 0.5rem;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border: 1px solid var(--vscode-inputOption-activeBorder, transparent);
  }
}

input[type="search"]::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
}

/* --- СОСТОЯНИЯ (LOADING / ERROR) --- */
.elf-body {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: row;
  gap: 1rem;
  padding: 1rem;
  box-sizing: border-box;
  overflow: hidden;
}

.elf-error {
  box-sizing: border-box;
  flex-direction: column;
  align-items: stretch;
  padding: 1rem;
  background-color: var(--vscode-inputValidation-errorBackground);
  border: 1px solid var(--vscode-inputValidation-errorBorder);
  border-radius: 0.6rem;
  max-width: 100%;
  overflow: hidden;

  >div {
    min-width: 0;
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

/* --- МОДАЛКА DIFF --- */
.elf-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.elf-modal {
  background-color: var(--vscode-editor-background);
  border: 1px solid var(--vscode-widget-border);
  border-radius: 0.4rem;
  width: 100%;
  max-width: 56rem; /* 900px */
  margin: 2rem;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0.25rem 0.75rem rgba(0, 0, 0, 0.3);

  .elf-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--vscode-widget-border);
    flex-wrap: wrap;
    gap: 1rem;

    h3 {
      margin: 0;
      font-size: 1.1rem;
    }

    .elf-modal-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
  }

  .elf-modal-body {
    padding: 1rem;
    overflow-y: auto;
  }
}

.elf-diff-summary {
  margin-bottom: 1rem;
  font-size: 1rem;
}

.elf-diff-list {
  display: flex;
  flex-direction: column;
}

.elf-diff-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(4.5rem, auto) minmax(6rem, auto);
  gap: 1rem;
  padding: 0.3rem 0.5rem;
  border-radius: 0.25rem;
  font-family: var(--vscode-editor-font-family);
  font-size: 0.8rem;
  align-items: center;

  &:hover {
    background-color: var(--vscode-list-hoverBackground);
  }

  &.elf-diff-header {
    font-weight: bold;
    border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
    margin-bottom: 0.5rem;
    color: var(--vscode-descriptionForeground);

    &:hover {
      background-color: transparent;
    }
  }

  .elf-diff-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--vscode-editor-foreground);
  }

  .elf-diff-old {
    color: var(--vscode-descriptionForeground);
    text-align: right;
    white-space: nowrap;
  }

  .elf-diff-size {
    text-align: right;
    font-weight: bold;
    white-space: nowrap;
  }

  .diff-plus {
    color: var(--vscode-gitDecoration-deletedResourceForeground);
  }

  .diff-minus {
    color: var(--vscode-gitDecoration-addedResourceForeground);
  }

  .diff-zero {
    color: var(--vscode-descriptionForeground);
  }
}
</style>