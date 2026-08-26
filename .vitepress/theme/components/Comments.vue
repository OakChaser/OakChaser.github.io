<script setup lang="ts">
import { useData } from "vitepress";
import { watch } from "vue";

const { title, isDark } = useData();

const setGiscusTheme = (theme: "catppuccin_mocha" | "catppuccin_latte") => {
  const iframe = document.querySelector("iframe.giscus-frame") as HTMLIFrameElement;
  iframe.contentWindow?.postMessage(
    {
      giscus: {
        setConfig: {
          theme: theme,
        },
      },
    },
    "https://giscus.app",
  );
};
const syncTheme = () => {
  setGiscusTheme(isDark.value ? "catppuccin_mocha" : "catppuccin_latte");
};
watch(isDark, syncTheme);
</script>

<template>
  <div :key="title" class="giscus" style="padding-top: 32px">
    <component
      :is="'script'"
      src="https://giscus.app/client.js"
      data-repo="OakChaser/OakChaser.github.io"
      data-repo-id="R_kgDOPWDMXg"
      data-category="Announcements"
      data-category-id="DIC_kwDOPWDMXs4CtosD"
      data-mapping="pathname"
      data-strict="1"
      data-reactions-enabled="1"
      data-emit-metadata="1"
      data-input-position="top"
      :data-theme="isDark ? 'catppuccin_mocha' : 'catppuccin_latte'"
      data-lang="zh-CN"
      crossorigin="anonymous"
      async />
  </div>
</template>
