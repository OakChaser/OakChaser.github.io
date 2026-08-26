---
title: "如何备份安卓字库"
description: "本文记录了在不使用第三方工具的情况下，通过命令行备份和恢复 Android 字库（分区镜像）的方法。"
author: "OakChaser"
minutes: 3
date: "2025-05-03"
tags:
    - Technical
    - Note
    - Android
---

> https://mrwei95.github.io/2024/08/16/Backup-Flash-Memory/

## 备份

1. 在 `sdcard` 分区中创建 `000_Backup` 目录用于保存备份文件

```bash
mkdir /sdcard/000_Backup
cd /sdcard/000_Backup
```

2. 生成脚本

```bash
ls -1 /dev/block/bootdevice/by-name | grep -ixvE "userdata|cache" | while IFS= read -r name; do echo "dd if=/dev/block/bootdevice/by-name/$name of=/sdcard/000_Backup/$name.img" >> /sdcard/000_Backup/001_Backup.sh; echo "fastboot flash $name $name.img" >> /sdcard/000_Backup/002_Restore.sh; done
```

3. 修改权限

```bash
chmod +x /sdcard/000_Backup/001_Backup.sh
```

4. 运行脚本

```bash
sudo /sdcard/000_Backup/001_Backup.sh
```

5. 把 `000_Backup` 转移到安全的地方

## 恢复

1. 以Fedora为例，安装 `android-tools`

```bash
sudo dnf install android-tools -y
```

2. 手机进入fastboot模式，然后用以下命令检测是否连接

```bash
fastboot devices
```

3. 进入电脑上的 `000_Backup` 目录，然后运行恢复脚本

```bash
cd /Path/To/000_Backup
chmod +x ./002_Restore.sh
./002_Restore.sh
```
