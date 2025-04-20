<template>
    <div ref="my-chart">
        <span class="my-chart-title">
            {{ props.title }}
        </span>
        <doughnutchart :data="chartData" :options="options" :height="400" />
    </div>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';

import { Doughnut as doughnutchart } from 'vue-chartjs';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Filler, Colors } from 'chart.js';
ChartJS.register(ArcElement, Tooltip, Legend, Filler, Colors);

export type MyDoughnutItem = {
    key: string;
    data: number;
}

const props = defineProps<{
    data: Array<MyDoughnutItem>;
    title?: string;
}>();

const symbols = useTemplateRef("my-chart");
ChartJS.defaults.color = window.getComputedStyle(document.documentElement).getPropertyValue('--vscode-editor-foreground') || "#cccc00";

const options = {
    responsive: false,
    maintainAspectRatio: false,
    interaction: {
        intersect: false,
    },
    plugins: {
        colors: {
            enabled: true,
            forceOverride: true
        },
    }
}

const chartData = computed(() => ({
    labels: props.data?.map(x => x.key) ?? ["None"],
    datasets: [{
        data: props.data?.map(x => x.data) ?? [0],
    }]
}))

</script>

<style lang="scss"></style>