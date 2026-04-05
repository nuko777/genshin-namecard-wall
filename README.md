# 原神名片墙 (Genshin Namecard Wall)

将原神名片排列成渐变色马赛克图案的单页 Web 应用。

## 功能

- **名片浏览** — 270 张名片，支持名称搜索、主题/地区/元素筛选
- **智能渐变匹配** — 选两个颜色 + 方向，算法自动从名片库中选出 16 张排列成 4×4 渐变色矩阵
- **6 区颜色采样** — 每张名片分 3×2 区域独立取色，匹配时考虑相邻名片边缘的颜色连续性
- **拖拽交互** — 从名片墙拖入预览槽位，槽位间拖拽交换，拖出网格删除
- **PNG 导出** — 2 倍分辨率导出预览图

## 技术栈

React 18 · Vite 5 · TypeScript · Less · Ant Design 5

## 快速开始

```bash
npm install
npm run dev      # 启动开发服务器 → http://localhost:5173
npm run build    # 生产构建
```

## 项目结构

```
src/
  App.tsx / App.less        # 根布局（50/50 双栏）
  hooks/                    # useNamecards, usePreview, useGradient, useDisabled
  components/
    NamecardWall/           # 名片墙 + 搜索筛选
    Preview/                # 4×4 预览网格 + 渐变面板
    Modal/                  # 名片详情弹窗
  utils/
    color.ts                # 颜色距离、插值
    gradient.ts             # 邻居感知匹配算法
    export.ts               # html2canvas 导出
scripts/
  calc_avg_colors.cjs       # 颜色预计算脚本
```

## 鸣谢

本项目的全部代码由 **Claude Code** + **DeepSeek V4** 协作生成，未经人类手工编写。

图片素材来源 [BitTopup Wiki](https://wiki.bittopup.com/zh-CN/genshin/namecards)，版权归米哈游/HoYoverse 所有，仅供个人学习使用。
