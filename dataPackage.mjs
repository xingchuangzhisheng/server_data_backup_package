#!/usr/bin/env zx

import { YAML, cd } from "zx";
import * as ejs from "ejs";
import * as fs from "fs";
import dayjs from "dayjs";
import path from "path";

const log = {
  info(...args) {
    console.log(chalk.cyan(...args));
  },
  warn(...args) {
    console.log(chalk.yellow(...args));
  },
  error(...args) {
    console.log(chalk.red(...args));
  },
  success(...args) {
    console.log(chalk.green(...args));
  },
};

const cwd = process.cwd();

const ArchiveFormat = {
  ZIP: ".zip",
  TAR: ".tar",
  TAR_GZ: ".tar.gz",
};

const archiveFormatHandle = {
  [ArchiveFormat.ZIP]: async (
    nodeFilename,
    paths,
    config,
    globalArchiveConfig
  ) => {
    config.archive = config.archive || {};
    const enableEncrypt =
      config.archive.enableEncrypt ||
      globalArchiveConfig.enableEncrypt ||
      false;
    const password = config.archive.password || globalArchiveConfig.password || "";
    if (enableEncrypt && typeof password === "string" && password.length > 0) {
      await $`zip -q -P ${password} -r ${nodeFilename} ${paths}`;
    } else {
      await $`zip -q -r ${nodeFilename} ${paths}`;
    }
  },
};

/**
 * 默认归档配置
 */
const defaultArchive = {
  format: ArchiveFormat.ZIP,
  enableEncrypt: false,
  password: "",
  targetDir: path.join(__dirname, "backup"),
};

const nowDate = dayjs(new Date());

function renderStr(str) {
  return ejs.render(str, {
    env: process.env,
    now: nowDate,
  });
}

async function handleBackupNode(globalArchive, nodeFilename, nodeConfig) {
  const formatSuffix = nodeConfig.format || globalArchive.format;
  const archiveHandle = archiveFormatHandle[formatSuffix];
  if (typeof archiveHandle !== "function") {
    throw `不支持的归档格式: ${format}`;
  }

  nodeFilename = nodeFilename + formatSuffix;

  const tmpStorageDir = nodeFilename + ".tmp";
  await $`mkdir -p ${tmpStorageDir}`;

  if (typeof nodeConfig.dir !== "string") {
    nodeConfig.dir = "";
  }

  try {
    const rawPaths = Array.isArray(nodeConfig.path)
      ? nodeConfig.path
      : [nodeConfig.path];

    const paths = [];

    for (let i = 0; i < rawPaths.length; i++) {
      const pathSplit = renderStr(rawPaths[i]).split(":");
      if (pathSplit.length < 1 || pathSplit.length > 2) {
        throw `路径配置错误: ${p}`;
      }

      const aliasPath = path.join(tmpStorageDir, pathSplit[0]);
      await $`rm -rf ${aliasPath}`;
      await $`mkdir -p ${path.dirname(aliasPath)}`;

      let copyPath = path.join(nodeConfig.dir, pathSplit[0]);
      if (pathSplit.length === 2) {
        copyPath = path.join(nodeConfig.dir, pathSplit[1]);
      }
      await $`cp -r ${copyPath} ${aliasPath}`;

      paths.push(pathSplit[0]);
    }

    cd(tmpStorageDir);

    await archiveHandle(nodeFilename, paths, nodeConfig, globalArchive);
  } catch (e) {
    await $`rm -rf ${nodeFilename}.`;
    throw `备份节点失败: ${e}`;
  } finally {
    cd(cwd);
    await $`rm -rf ${tmpStorageDir}`;
  }
}

async function main(args) {
  const configFilepath = args[0] || "dataBackup.yml";
  let configFileContentStr = "";

  log.info("使用的配置文件路径:", configFilepath);
  try {
    configFileContentStr = (
      await fs.promises.readFile(configFilepath)
    ).toString("utf-8");
  } catch (e) {
    throw `读取配置文件{ ${configFilepath} } 失败: ${e}`;
  }

  const config = YAML.parse(configFileContentStr);
  const backupNodes = config.backup;
  if (!backupNodes) {
    throw "备份节点配置为空";
  }

  const backupKeys = Object.keys(backupNodes);
  if (backupKeys.length === 0) {
    throw "备份节点配置为空";
  }

  config.archive = config.archive || {};

  const globalArchive = {};
  const archiveAllowKeys = Object.keys(defaultArchive);
  archiveAllowKeys.forEach(
    (key) => (globalArchive[key] = config.archive[key] || defaultArchive[key])
  );

  globalArchive.targetDir = renderStr(globalArchive.targetDir);

  await $`mkdir -p ${globalArchive.targetDir}`;

  for (const nodeName of backupKeys) {
    const nodeConfig = backupNodes[nodeName];
    log.info(`开始备份节点: ${nodeName}`);

    const nodeFilepath = path.resolve(
      globalArchive.targetDir,
      renderStr(nodeName)
    );

    if (!nodeFilepath.startsWith(globalArchive.targetDir)) {
      throw `节点备份路径不允许超出全局备份路径: ${nodeFilepath}`;
    }

    await $`mkdir -p ${path.dirname(nodeFilepath)}`;
    await handleBackupNode(globalArchive, nodeFilepath, nodeConfig);
  }
}

try {
  await main(process.argv.slice(3));
} catch (e) {
  log.error(e);
  process.exit(-1);
}
