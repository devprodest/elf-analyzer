import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { ElfInfo } from '../../../common/elfInfo';
import { useEventListener } from '@vueuse/core';

import einfo from './elfinfo.json'

export const useElfStore = defineStore('elf', () => {


  const info = ref<string>(JSON.stringify(einfo));

  const elf = computed<ElfInfo>(() => JSON.parse(info.value));

  async function updateElfInfo() {
    // @ts-ignore
    vscode.postMessage({ type: 'getinfo' });
  };



  useEventListener(window, 'message', (event: any) => {
    const message = event.data;

    switch (message.type) {
      case 'update':
        info.value = message.text;
        break;

      default:
        break;
    }
  });


  return { info, elf, updateElfInfo };

});
