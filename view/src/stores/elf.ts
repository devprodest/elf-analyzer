import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { ElfInfo } from '../../../common/elfInfo';
import { useEventListener } from '@vueuse/core';
import {sendMessage} from '../../../common/utils';


// import einfo from './elfinfo.json';

interface onUpdatedInfoCallback { (): void }


export const useElfStore = defineStore('elf', () => {

  // const info = ref<string>(JSON.stringify(einfo));
  const info = ref<string>('{"file":"test.elf","elements":[]}');

  const elf = computed<ElfInfo>(() => JSON.parse(info.value));

  const UpdatedInfoCallback = ref<onUpdatedInfoCallback>(() => { });


  async function updateElfInfo(callback: onUpdatedInfoCallback) {

    UpdatedInfoCallback.value = callback;
    // @ts-ignore
    sendMessage({ type: 'get-info' });
  };

  async function navigateTo(file: string) {
    // @ts-ignore
    sendMessage({ type: 'navigate', value: file });
  };



  useEventListener(window, 'message', (event: any) => {
    const message = event.data;

    switch (message.type) {
      case 'update':
        info.value = message.value;
        UpdatedInfoCallback.value();
        break;

      default:
        break;
    }
  });


  return { info, elf, updateElfInfo, navigateTo };

});
