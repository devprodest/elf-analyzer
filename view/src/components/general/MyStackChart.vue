<template>

    <div class="my-stack-wrapper">
        <span class="my-chart-title">
            <slot></slot>
        </span>

        <div class="my-stack-chart">
            <VTooltip class="my-stack-item" :light="!!sectionSize" v-for="x, i in sections" :key="i"
                :style="`height: ${x.size * 95}dvh;`" @click="click(x.meta)">

                <div class="my-stack-item-fill"></div>

                <template #popper>
                    <div class="my-stack-item-pop">
                        <div class="my-stack-item-pop-address">{{ x.meta }} </div>
                        <div class="my-stack-item-pop-size">Size: {{ x.data }} </div>
                        <div class="my-stack-item-pop-names">
                            <span v-for="(k, i) in x.key" :key="i">{{ k }}</span>
                        </div>
                    </div>
                </template>
            </VTooltip>
        </div>

    </div>

</template>

<script setup lang="ts">
import { computed } from 'vue';
import FloatingVue from 'floating-vue';

FloatingVue.options.themes.tooltip.placement = 'right';

export type MyStackItem = {
    key: string[];
    data: number;
    meta?: string;
}

type StackItem = {
    key: string[];
    data: number;
    size: number;
    meta?: string;
}

const props = defineProps<{
    data: Array<MyStackItem>;
}>();

const emit = defineEmits(['click']);


const click = (data?: string) => {
    console.log(data)
    emit('click', data);
}


const sectionSize = computed(() => {
    return props.data.reduce((s, x) => s + x.data, 0);
});



const sections = computed<Array<StackItem>>(() => {
    const size = sectionSize.value;
    if (size === 0) return [{ ...props.data[0], size: 1 }];
    return props.data.map(x => ({ ...x, size: x.data / size }));
});


</script>

<style lang="scss">
.my-stack-item-pop {
    color: var(--vscode-editor-foreground);

    .my-stack-item-pop-names {
        font-size: 0.8rem;
        display: grid;
        grid-template-columns: repeat(4, auto);
        gap: .25rem;
        padding: .5rem;
        background-color: var(--vscode-editor-background);
        border-radius: 0.5rem;
        flex-flow: row wrap;
    }
}

.my-stack-wrapper {
    display: flex;
    flex-direction: row;
    padding-top: 0.5rem;

    .my-chart-title {
        padding: 0.5rem;
        writing-mode: vertical-rl;
    }
}

.my-stack-chart {
    display: flex;
    flex-direction: column;

    .my-stack-item {
        width: 100%;
        transition: 0.3s;
        background-color: var(--vscode-editor-foreground);

        &[light=false] {
            filter: brightness(0.2);
        }

        .my-stack-item-fill {
            width: 100%;
            height: 100%;
        }

        &[light=true] {

            &:hover {
                filter: saturate(3);
                transform: scaleX(1.2);
                box-shadow: 0rem 0rem 0.5rem;
            }

            &:nth-child(7n-1) {
                background-color: #36a2eb;
            }

            &:nth-child(7n-2) {
                background-color: #ff6384;
            }

            &:nth-child(7n-3) {
                background-color: #4bc0c0;
            }

            &:nth-child(7n-4) {
                background-color: #ff9f40;
            }

            &:nth-child(7n-5) {
                background-color: #9966ff;
            }

            &:nth-child(7n-6) {
                background-color: #ffcd56;
            }

            &:nth-child(7n-7) {
                background-color: #c9cbcf;
            }
        }
    }
}
</style>