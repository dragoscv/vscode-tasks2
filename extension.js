const vscode = require('vscode');
const os = require('os');

var statusBarArray = [];
var menuStatusBar;
var actionsStatusBar;
var menuItems = [];
var selectList = [];
var eventChangeActiveTextEditor;
var outputChannel;
const RunTaskCommand = "actboy168.run-task"
const SelectTaskCommand = "actboy168.select-task"
const OpenMenuCommand = "actboy168.tasks2.openMenu"
const OpenSettingsCommand = "actboy168.tasks2.openSettings"
const ShowActionsCommand = "actboy168.tasks2.showActions"
const RefreshCommand = "actboy168.tasks2.refresh"
const ManageHiddenCommand = "actboy168.tasks2.manageHiddenTasks"
const ManageMenuHiddenCommand = "actboy168.tasks2.manageMenuHiddenTasks"
const ManageListHiddenCommand = "actboy168.tasks2.manageListHiddenTasks"
const SettingsQuery = "@ext:dragoscv.tasks2"

//const VSCodeVersion = (function() {
//    const res = vscode.version.split(".");
//    return parseInt(res[1]);
//})()

function LOG(msg) {
    if (outputChannel === undefined) {
        outputChannel = vscode.window.createOutputChannel("Extension-Tasks");
    }
    outputChannel.appendLine(msg);
}

function needShowStatusBar(statusBar, currentFilePath) {
    try {
        return !statusBar.filePattern || (currentFilePath && new RegExp(statusBar.filePattern).test(currentFilePath));
    } catch (error) {
        LOG(`Error validating status bar item '${statusBar.text}' filePattern for active file '${currentFilePath}'. ${error.name}: ${error.message}`);
    }
    return false;
}

function getDisplayMode() {
    const settings = vscode.workspace.getConfiguration("tasks.statusbar");
    const v = settings.get("displayMode", "menu");
    if (v === "all" || v === "both") return v;
    return "menu";
}

function getLegacyHiddenTasks() {
    const settings = vscode.workspace.getConfiguration("tasks.statusbar");
    const list = settings.get("hiddenTasks", []);
    return Array.isArray(list) ? list : [];
}

function getViewHiddenTasks(view) {
    // view: "menu" | "list"
    const settings = vscode.workspace.getConfiguration("tasks.statusbar");
    const key = view === "list" ? "list.hiddenTasks" : "menu.hiddenTasks";
    const list = settings.get(key, []);
    return Array.isArray(list) ? list : [];
}

function getHiddenTasks(view) {
    // Merged hidden list for a given view ("menu" or "list") = legacy + per-view.
    // If no view is given, fall back to legacy + active mode's list.
    if (view !== "menu" && view !== "list") {
        view = getDisplayMode() === "all" ? "list" : "menu";
    }
    const merged = new Set([...getLegacyHiddenTasks(), ...getViewHiddenTasks(view)]);
    return [...merged];
}

function isTaskHidden(label, view) {
    if (typeof label !== "string" || label.length === 0) return false;
    return getHiddenTasks(view).indexOf(label) !== -1;
}

async function setHiddenTasksForView(view, list) {
    const settings = vscode.workspace.getConfiguration("tasks.statusbar");
    const key = view === "list" ? "list.hiddenTasks" : "menu.hiddenTasks";
    const inspected = settings.inspect(key);
    let target = vscode.ConfigurationTarget.Workspace;
    if (!vscode.workspace.workspaceFolders && !vscode.workspace.workspaceFile) {
        target = vscode.ConfigurationTarget.Global;
    } else if (inspected && inspected.workspaceValue === undefined && inspected.globalValue !== undefined) {
        target = vscode.ConfigurationTarget.Global;
    }
    await settings.update(key, list, target);
}

async function hideTaskByLabel(label, view) {
    if (typeof label !== "string" || label.length === 0) return;
    if (view !== "menu" && view !== "list") {
        view = getDisplayMode() === "all" ? "list" : "menu";
    }
    const list = getViewHiddenTasks(view).slice();
    if (list.indexOf(label) === -1) {
        list.push(label);
        await setHiddenTasksForView(view, list);
    }
}

async function unhideTaskByLabel(label, view) {
    if (view !== "menu" && view !== "list") {
        view = getDisplayMode() === "all" ? "list" : "menu";
    }
    const list = getViewHiddenTasks(view).filter(l => l !== label);
    await setHiddenTasksForView(view, list);
}

function updateStatusBar() {
    for (const statusBar of statusBarArray) {
        statusBar.hide();
    }
    selectList = [];

    const settings = vscode.workspace.getConfiguration("tasks.statusbar");
    const currentFilePath = vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.fileName;
    const mode = getDisplayMode();
    const showMenu = mode === "menu" || mode === "both";
    const showList = mode === "all" || mode === "both";

    // Always rebuild menu items (used when menu view is active).
    menuItems = [];
    if (showMenu) {
        for (let i = 0; i < statusBarArray.length - 1; ++i) {
            const statusBar = statusBarArray[i];
            if (!needShowStatusBar(statusBar, currentFilePath)) continue;
            if (isTaskHidden(statusBar.taskLabel, "menu")) continue;
            menuItems.push({
                label: statusBar.text,
                description: statusBar.tooltip ? statusBar.tooltip.value : undefined,
                task: statusBar.command.arguments[0],
                taskLabel: statusBar.taskLabel
            });
        }
        if (menuStatusBar) {
            if (menuItems.length > 0) {
                menuStatusBar.show();
                if (actionsStatusBar) actionsStatusBar.show();
            } else {
                menuStatusBar.hide();
                if (actionsStatusBar) actionsStatusBar.hide();
            }
        }
    }

    if (showList) {
        let count = 0;
        for (let i = 0; i < statusBarArray.length - 1; ++i) {
            const statusBar = statusBarArray[i];
            if (!needShowStatusBar(statusBar, currentFilePath)) continue;
            if (isTaskHidden(statusBar.taskLabel, "list")) continue;
            if (typeof settings.limit === "number" && settings.limit <= count) {
                selectList.push({
                    label: statusBar.text,
                    description: statusBar.tooltip ? statusBar.tooltip.value : undefined,
                    task: statusBar.command.arguments[0]
                });
            }
            else {
                statusBar.show();
                count++;
            }
        }
        if (selectList.length > 0) {
            statusBarArray[statusBarArray.length - 1].show();
        }
    }
}

function openUpdateStatusBar() {
    if (eventChangeActiveTextEditor === undefined) {
        eventChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor(updateStatusBar);
    }
    updateStatusBar();
}

function closeUpdateStatusBar() {
    if (eventChangeActiveTextEditor !== undefined) {
        eventChangeActiveTextEditor.dispose();
        eventChangeActiveTextEditor = undefined;
    }
}

function cleanStatusBar() {
    statusBarArray.forEach(i => {
        i.hide();
        i.dispose();
    });
    statusBarArray = [];
    menuItems = [];
    if (menuStatusBar) menuStatusBar.hide();
    if (actionsStatusBar) actionsStatusBar.hide();
}

function getAlignment() {
    const settings = vscode.workspace.getConfiguration("tasks.statusbar");
    return settings.get("alignment", "left") === "right"
        ? vscode.StatusBarAlignment.Right
        : vscode.StatusBarAlignment.Left;
}

function getPriority() {
    const settings = vscode.workspace.getConfiguration("tasks.statusbar");
    const p = settings.get("priority");
    return typeof p === "number" ? p : 50;
}

function ensureMenuStatusBar() {
    const settings = vscode.workspace.getConfiguration("tasks.statusbar");
    const alignment = getAlignment();
    const priority = getPriority();
    const label = settings.get("menu.label", "Tasks");
    const icon = settings.get("menu.icon", "checklist");
    const showActions = settings.get("menu.showActionsButton", true);

    // Desired left-to-right visual order: [Actions kebab] [Tasks menu] [task items].
    // On LEFT alignment, higher priority renders further to the LEFT.
    // On RIGHT alignment, higher priority renders further to the RIGHT.
    // Task items use `priority` (rightmost of the group), menu uses priority+1,
    // actions uses priority+2 so they sit to the left of the items group.
    const isRight = alignment === vscode.StatusBarAlignment.Right;
    const menuPriority = isRight ? priority - 1 : priority + 1;
    const actionsPriority = isRight ? priority - 2 : priority + 2;

    if (menuStatusBar && (menuStatusBar.alignment !== alignment || menuStatusBar.priority !== menuPriority)) {
        menuStatusBar.dispose();
        menuStatusBar = undefined;
    }
    if (!menuStatusBar) {
        menuStatusBar = vscode.window.createStatusBarItem(alignment, menuPriority);
        menuStatusBar.name = "Tasks2";
    }
    menuStatusBar.text = icon ? `$(${icon}) ${label}` : label;
    menuStatusBar.tooltip = new vscode.MarkdownString(
        `**Tasks2**\n\nClick to pick a task to run.\n\n[$(gear) Open Settings](command:${OpenSettingsCommand})`,
        true
    );
    menuStatusBar.tooltip.isTrusted = true;
    menuStatusBar.command = OpenMenuCommand;

    if (showActions) {
        if (actionsStatusBar && (actionsStatusBar.alignment !== alignment || actionsStatusBar.priority !== actionsPriority)) {
            actionsStatusBar.dispose();
            actionsStatusBar = undefined;
        }
        if (!actionsStatusBar) {
            actionsStatusBar = vscode.window.createStatusBarItem(alignment, actionsPriority);
            actionsStatusBar.name = "Tasks2 Actions";
        }
        actionsStatusBar.text = "$(kebab-vertical)";
        actionsStatusBar.tooltip = "Tasks2: Actions (Settings, Refresh, ...)";
        actionsStatusBar.command = ShowActionsCommand;
    } else if (actionsStatusBar) {
        actionsStatusBar.dispose();
        actionsStatusBar = undefined;
    }
}

function disposeMenuStatusBar() {
    if (menuStatusBar) {
        menuStatusBar.dispose();
        menuStatusBar = undefined;
    }
    if (actionsStatusBar) {
        actionsStatusBar.dispose();
        actionsStatusBar = undefined;
    }
}

function deactivate() {
    closeUpdateStatusBar();
    cleanStatusBar();
    disposeMenuStatusBar();
    if (outputChannel !== undefined) {
        outputChannel.dispose();
    }
}

const platform = os.platform();

function getPlatformValue(t) {
    if (platform == "win32") {
        return t.windows
    }
    else if (platform == "darwin") {
        return t.osx
    }
    else {
        return t.linux
    }
}

function deepClone(a, b) {
    if (typeof b !== "object" || !b) {
        return b;
    }
    if (Array.isArray(b)) {
        return b.slice();
    }
    let o = typeof a === "object" ? a : {};
    for (const k in b) {
        o[k] = deepClone(o[k], b[k]);
    }
    return o;
};

function copyObject(t, a) {
    for (const k in a) {
        t[k] = deepClone(t[k], a[k])
    }
}

function copyObjectWithIgnore(t, a, ignore) {
    for (const k in a) {
        if (!(k in ignore)) {
            t[k] = deepClone(t[k], a[k])
        }
    }
}

const ignore_globals = {
    tasks: true,
    version: true,
    windows: true,
    osx: true,
    linux: true,
};

const ignore_locals = {
    windows: true,
    osx: true,
    linux: true,
};

function computeTaskInfo(task, config) {
    let t = {}
    copyObjectWithIgnore(t, config, ignore_globals)
    copyObject(t, getPlatformValue(config))
    copyObjectWithIgnore(t, task, ignore_locals)
    copyObject(t, getPlatformValue(task))
    if (t.type === undefined) {
        t.type = "process";
    }
    return t
}

const ObjectAttribute = {
    label: "name",
    detail: "detail",
};

const VSCodeAttribute = {
    label: true,
    icon: true,
    detail: true,
    hide: true,
};

const HasDefaultAttribute = {
    hide: true,
    color: true,
};

function isObject(obj) {
    var type = typeof obj;
    return type === 'object' && !!obj;
}

function getAttribute(taskObject, taskInfo, key, isRunning) {
    if (isObject(taskInfo.options) && isObject(taskInfo.options.statusbar)) {
        if (isRunning && isObject(taskInfo.options.statusbar.running)) {
            if (key in taskInfo.options.statusbar.running) {
                return taskInfo.options.statusbar.running[key];
            }
        }
        if (key in taskInfo.options.statusbar) {
            return taskInfo.options.statusbar[key];
        }
    }
    if (taskObject !== undefined && key in ObjectAttribute) {
        const objectKey = ObjectAttribute[key];
        if (objectKey in taskObject) {
            return taskObject[objectKey];
        }
    }
    if (key in VSCodeAttribute) {
        if (key in taskInfo) {
            return taskInfo[key];
        }
    }
    if (key in HasDefaultAttribute) {
        const settings = vscode.workspace.getConfiguration("tasks.statusbar.default");
        if (settings === undefined) {
            return;
        }
        return settings[key];
    }
}

function computeTaskExecutionId(taskInfo, type) {
    const props = [];
    const command = taskInfo.command;
    const args = taskInfo.args;
    props.push(type);
    if (typeof command === "string") {
        props.push(command);
    }
    else if (Array.isArray(command)) {
        let cmds;
        for (const c of command) {
            if (typeof c === "string") {
                if (cmds === undefined) {
                    cmds = c;
                }
                else {
                    cmds += ' ' + c;
                }
            }
        }
        if (cmds !== undefined) {
            props.push(cmds);
        }
    }
    else {
        return;
    }
    if (Array.isArray(args) && args.length > 0) {
        for (const arg of args) {
            if (typeof arg == "string") {
                props.push(arg);
            } else if (typeof arg == "object") {
                props.push(arg.value);
            }
        }
    }
    let id = '';
    for (let i = 0; i < props.length; i++) {
        id += props[i].replace(/,/g, ',,') + ',';
    }
    return id;
}

function computeTaskExecutionDefinition(taskInfo, type) {
    const id = computeTaskExecutionId(taskInfo, type);
    if (id === undefined) {
        return {
            type: "$empty"
        };
    }
    return {
        type: id !== undefined ? type : "$empty",
        id: id
    };
}

function computeTaskDefinition(taskInfo) {
    const type = taskInfo.type;
    if (type == "shell" || type == "process") {
        return computeTaskExecutionDefinition(taskInfo, type);
    }
    return taskInfo;
}

function deepEqual(a, b) {
    const a_type = typeof a;
    const b_type = typeof b;
    if (a_type !== b_type) {
        return false;
    }
    if (a_type !== "object") {
        return a === b;
    }
    const a_keys = Object.keys(a);
    const b_keys = Object.keys(b);
    if (a_keys.length !== b_keys.length) {
        return false;
    }
    for (const key of a_keys) {
        if (!deepEqual(a[key], b[key])) {
            return false;
        }
    }
    return true;
}

function matchComposite(a, b) {
    if (a.definition.type == "npm") {
        // TODO: check detail
        if (b.label === undefined) {
            return a.name === b.script;
        }
        else {
            return a.name === b.label;
        }
    }
    if (a.detail !== b.detail) {
        return false;
    }
    return a.name === b.label;
}

function matchDefinition(a, b) {
    for (const k in a) {
        const v = a[k];
        if (!deepEqual(v, b[k])) {
            return false;
        }
    }
    return true;
}

function matchTask(tasks, taskInfo) {
    const taskDefinition = computeTaskDefinition(taskInfo);
    for (let i = 0; i < tasks.length; ++i) {
        const v = tasks[i];
        if (matchComposite(v, taskInfo)) {
            if (v.definition.type === "$empty"
                || v.definition.type === "$composite"
                || matchDefinition(v.definition, taskDefinition)
            ) {
                tasks.splice(i, 1);
                return v;
            }
        }
    }
}

function convertColor(color) {
    if (typeof color == "string") {
        if (color.slice(0, 1) === "#") {
            return color;
        }
        else if (color === "") {
            return undefined;
        }
        else {
            return new vscode.ThemeColor(color);
        }
    }
    return undefined;
}

function convertTooltip(tooltip) {
    if (tooltip) {
        let md = new vscode.MarkdownString(tooltip);
        md.isTrusted = true;
        md.supportThemeIcons = true;
        return md;
    }
}

function createSelectStatusBar() {
    const settings = vscode.workspace.getConfiguration("tasks.statusbar.select");
    return {
        text: settings.label || "...",
        tooltip: undefined,
        color: convertColor(settings.color),
        backgroundColor: undefined,
        filePattern: undefined,
        command: SelectTaskCommand
    };
}

function syncStatusBar(memoryStatusBarArray) {
    const alignment = getAlignment();
    const priority = getPriority();
    const mode = getDisplayMode();

    // If alignment/priority changed, recreate all items so they appear on the correct side.
    if (statusBarArray.length > 0) {
        const first = statusBarArray[0];
        if (first.alignment !== alignment || first.priority !== priority) {
            cleanStatusBar();
        }
    }

    if (mode === "menu" || mode === "both") {
        ensureMenuStatusBar();
    } else {
        disposeMenuStatusBar();
    }

    const diff = memoryStatusBarArray.length - statusBarArray.length;
    for (let i = 0; i < diff; ++i) {
        let statusBar = vscode.window.createStatusBarItem(alignment, priority);
        statusBar.name = "Tasks";
        statusBarArray.push(statusBar);
    }
    for (let i = 0; i < -diff; ++i) {
        let statusBar = statusBarArray.pop();
        statusBar.hide();
        statusBar.dispose();
    }
    for (let i = 0; i < memoryStatusBarArray.length; ++i) {
        let to = statusBarArray[i];
        const from = memoryStatusBarArray[i];
        to.text = from.text;
        to.tooltip = from.tooltip;
        to.color = from.color;
        to.backgroundColor = from.backgroundColor;
        to.filePattern = from.filePattern;
        to.command = from.command;
        to.taskLabel = from.taskLabel;
    }
}

function matchTasksInScope(memoryStatusBarArray, tasks, runningTasks, config) {
    if (typeof config != "object" || !Array.isArray(config.tasks)) {
        return;
    }
    for (const taskCfg of config.tasks) {
        const taskInfo = computeTaskInfo(taskCfg, config);
        const hide = getAttribute(undefined, taskInfo, "hide");
        if (hide) {
            continue;
        }
        const taskObject = matchTask(tasks, taskInfo);
        if (!taskObject) {
            let label = getAttribute(undefined, taskInfo, "label");
            if (label !== undefined) {
                LOG(`Not found task: ${label}`);
            }
            else {
                LOG(`Not found task: { type:${taskCfg.type} }`);
            }
            continue;
        }
        const isRunning = runningTasks[taskObject._id];
        let label = getAttribute(taskObject, taskInfo, "label", isRunning);
        // Per-view hidden filtering happens at render time (updateStatusBar) so each view
        // can independently include/exclude tasks. We keep all matched tasks here.
        const rawLabel = label;
        const icon = getAttribute(taskObject, taskInfo, "icon", isRunning);
        if (icon && icon.id) {
            label = `$(${icon.id}) ${label}`;
        }
        const detail = getAttribute(taskObject, taskInfo, "detail");
        const color = getAttribute(taskObject, taskInfo, "color", isRunning);
        const backgroundColor = getAttribute(taskObject, taskInfo, "backgroundColor", isRunning);
        const filePattern = getAttribute(taskObject, taskInfo, "filePattern");
        memoryStatusBarArray.push({
            text: label,
            taskLabel: rawLabel,
            tooltip: convertTooltip(detail),
            color: convertColor(color),
            backgroundColor: backgroundColor ? new vscode.ThemeColor(backgroundColor) : undefined,
            filePattern: filePattern,
            command: {
                command: RunTaskCommand,
                arguments: [taskObject]
            }
        })
    }
}

function matchAllTasks(tasks) {
    let runningTasks = {};
    for (const e of vscode.tasks.taskExecutions) {
        runningTasks[e.task._id] = true;
    }
    // todo: use task.scope to filter
    let memoryStatusBarArray = [];
    const configuration = vscode.workspace.getConfiguration();
    if (configuration) {
        const tasksJson = configuration.inspect('tasks');
        if (tasksJson) {
            matchTasksInScope(memoryStatusBarArray, tasks, runningTasks, tasksJson.globalValue);
            matchTasksInScope(memoryStatusBarArray, tasks, runningTasks, tasksJson.workspaceValue);
        }
    }
    if (vscode.workspace.workspaceFile !== undefined) {
        for (const workspaceFolder of vscode.workspace.workspaceFolders) {
            const configuration = vscode.workspace.getConfiguration(null, workspaceFolder.uri);
            if (configuration) {
                const tasksJson = configuration.inspect('tasks');
                if (tasksJson) {
                    matchTasksInScope(memoryStatusBarArray, tasks, runningTasks, tasksJson.workspaceFolderValue);
                }
            }
        }
    }
    for (const task of tasks) {
        LOG(`No match task: ${task.name}`);
    }
    return memoryStatusBarArray;
}

function loadTasks() {
    if (vscode.workspace.workspaceFolders === undefined) {
        cleanStatusBar();
        closeUpdateStatusBar();
        return;
    }

    vscode.tasks.fetchTasks().then((tasks) => {
        tasks = tasks.filter(task => task.source === "Workspace");
        let memoryStatusBarArray = matchAllTasks(tasks);
        if (memoryStatusBarArray.length > 0) {
            memoryStatusBarArray.push(createSelectStatusBar());
            syncStatusBar(memoryStatusBarArray);
            openUpdateStatusBar();
        }
        else {
            cleanStatusBar();
            closeUpdateStatusBar();
        }
    });
}

const MinimumFetchInterval = 1000;
var fetchLastTime = 0;
var fetchTimer;

function loadTasksDelay(timeout) {
    if (fetchTimer !== undefined) {
        clearTimeout(fetchTimer);
    }
    fetchTimer = setTimeout(() => {
        fetchTimer = undefined;
        fetchLastTime = Date.now();
        loadTasks();
    }, timeout);
}

function loadTasksWait() {
    const now = Date.now();
    if (now < fetchLastTime + MinimumFetchInterval) {
        loadTasksDelay(MinimumFetchInterval);
    } else {
        if (fetchTimer === undefined) {
            fetchLastTime = now;
            loadTasks();
        }
    }
}

function refreshTask(task) {
    if (task.source !== "Workspace") {
        return;
    }
    let memoryStatusBarArray = matchAllTasks([task]);
    if (memoryStatusBarArray.length == 0) {
        return;
    }
    let found = statusBarArray.find((statusBar) => {
        if (!statusBar.command.arguments) {
            return false;
        }
        return statusBar.command.arguments[0]._id === task._id;
    });
    if (found) {
        const statusBar = memoryStatusBarArray[0];
        found.text = statusBar.text;
        found.tooltip = statusBar.tooltip;
        found.color = statusBar.color;
        found.backgroundColor = statusBar.backgroundColor;
    }
}

function runTask(task) {
    vscode.tasks.executeTask(task).catch((err) => {
        vscode.window.showWarningMessage(err.message).then(_ => undefined);
    });
}

function openTasksMenu() {
    const items = menuItems.length > 0 ? menuItems : [];
    if (items.length === 0) {
        vscode.window.showInformationMessage("Tasks2: no tasks available for the current context.");
        return;
    }
    const hideButton = {
        iconPath: new vscode.ThemeIcon("eye-closed"),
        tooltip: "Hide this task from the status bar"
    };
    const decorate = (entries) => entries.map(it => Object.assign({}, it, {
        buttons: it.taskLabel ? [hideButton] : undefined
    }));
    const qp = vscode.window.createQuickPick();
    qp.items = decorate(items);
    qp.placeholder = "Select task to execute";
    qp.matchOnDescription = true;
    const settingsButton = {
        iconPath: new vscode.ThemeIcon("gear"),
        tooltip: "Open Tasks2 Settings"
    };
    const refreshButton = {
        iconPath: new vscode.ThemeIcon("refresh"),
        tooltip: "Refresh tasks"
    };
    const manageHiddenButton = {
        iconPath: new vscode.ThemeIcon("eye"),
        tooltip: "Manage hidden tasks"
    };
    qp.buttons = [refreshButton, manageHiddenButton, settingsButton];
    qp.onDidTriggerButton((btn) => {
        if (btn === settingsButton) {
            qp.hide();
            vscode.commands.executeCommand("workbench.action.openSettings", SettingsQuery);
        } else if (btn === refreshButton) {
            loadTasksWait();
        } else if (btn === manageHiddenButton) {
            qp.hide();
            manageHiddenTasks();
        }
    });
    qp.onDidTriggerItemButton(async (e) => {
        if (e.button === hideButton && e.item && e.item.taskLabel) {
            await hideTaskByLabel(e.item.taskLabel, "menu");
            vscode.window.setStatusBarMessage(`Tasks2: hidden "${e.item.taskLabel}" from menu`, 3000);
            qp.hide();
        }
    });
    qp.onDidAccept(() => {
        const sel = qp.selectedItems[0];
        qp.hide();
        if (sel && sel.task) {
            runTask(sel.task);
        }
    });
    qp.onDidHide(() => qp.dispose());
    qp.show();
}

function manageHiddenTasksForView(view) {
    // view: "menu" | "list"
    const viewLabel = view === "list" ? "list view" : "menu view";
    const hidden = getHiddenTasks(view);
    const legacy = new Set(getLegacyHiddenTasks());
    const perView = new Set(getViewHiddenTasks(view));
    // Collect currently known task labels.
    const knownLabels = new Set();
    for (let i = 0; i < statusBarArray.length - 1; ++i) {
        const sb = statusBarArray[i];
        if (sb && sb.taskLabel) knownLabels.add(sb.taskLabel);
    }
    const allLabels = new Set([...hidden, ...knownLabels]);
    if (allLabels.size === 0) {
        vscode.window.showInformationMessage("Tasks2: no tasks discovered yet.");
        return;
    }
    const items = [...allLabels].sort().map(label => {
        const isLegacy = legacy.has(label);
        const isHidden = isLegacy || perView.has(label);
        let description;
        if (isLegacy) {
            description = "$(eye-closed) hidden (shared list)";
        } else if (isHidden) {
            description = "$(eye-closed) hidden";
        } else {
            description = "$(eye) visible";
        }
        return {
            label,
            description,
            picked: !isHidden,
            _legacy: isLegacy
        };
    });
    vscode.window.showQuickPick(items, {
        canPickMany: true,
        placeHolder: `Check tasks to keep VISIBLE in the ${viewLabel} (uncheck to hide)`
    }).then(async (picked) => {
        if (!picked) return;
        const visibleSet = new Set(picked.map(p => p.label));
        // Compute new per-view hidden list. Legacy entries cannot be removed here
        // (they are shared) — show a hint if user tried to unhide one.
        const newHidden = [];
        let blockedByLegacy = 0;
        for (const label of allLabels) {
            if (visibleSet.has(label)) {
                if (legacy.has(label)) blockedByLegacy++;
                continue;
            }
            if (legacy.has(label)) continue; // already hidden via legacy list, no need to duplicate
            newHidden.push(label);
        }
        await setHiddenTasksForView(view, newHidden);
        let msg = `Tasks2: ${viewLabel} hidden ${newHidden.length} task(s)`;
        if (blockedByLegacy > 0) {
            msg += ` (${blockedByLegacy} still hidden via legacy 'tasks.statusbar.hiddenTasks')`;
        }
        vscode.window.setStatusBarMessage(msg, 4000);
    });
}

function manageHiddenTasks() {
    const mode = getDisplayMode();
    if (mode === "both") {
        vscode.window.showQuickPick([
            { label: "$(list-unordered) Menu view", value: "menu", description: "Tasks shown in the dropdown Quick Pick" },
            { label: "$(symbol-array) List view", value: "list", description: "Per-task status bar items" }
        ], { placeHolder: "Which view's hidden tasks do you want to manage?" }).then((picked) => {
            if (!picked) return;
            manageHiddenTasksForView(picked.value);
        });
        return;
    }
    manageHiddenTasksForView(mode === "all" ? "list" : "menu");
}

function showActionsMenu() {
    const actions = [
        {
            label: "$(gear) Open Settings",
            description: "Configure Tasks2",
            action: "settings"
        },
        {
            label: "$(refresh) Refresh Tasks",
            description: "Re-scan tasks.json",
            action: "refresh"
        },
        {
            label: "$(eye-closed) Manage Hidden Tasks",
            description: "Choose which tasks appear in the status bar",
            action: "manageHidden"
        },
        {
            label: "$(list-unordered) Manage Menu Hidden Tasks",
            description: "Hide/show tasks in the dropdown menu view",
            action: "manageMenuHidden"
        },
        {
            label: "$(symbol-array) Manage List Hidden Tasks",
            description: "Hide/show tasks in the per-task list view",
            action: "manageListHidden"
        },
        {
            label: "$(list-unordered) Show Tasks Menu",
            description: "Pick a task to run",
            action: "menu"
        },
        {
            label: "$(settings-gear) Edit tasks.json",
            description: "Open the workspace tasks.json file",
            action: "editTasks"
        }
    ];
    vscode.window.showQuickPick(actions, { placeHolder: "Tasks2 actions" }).then((picked) => {
        if (!picked) return;
        switch (picked.action) {
            case "settings":
                vscode.commands.executeCommand("workbench.action.openSettings", SettingsQuery);
                break;
            case "refresh":
                loadTasksWait();
                break;
            case "manageHidden":
                manageHiddenTasks();
                break;
            case "manageMenuHidden":
                manageHiddenTasksForView("menu");
                break;
            case "manageListHidden":
                manageHiddenTasksForView("list");
                break;
            case "menu":
                openTasksMenu();
                break;
            case "editTasks":
                vscode.commands.executeCommand("workbench.action.tasks.openUserTasks").then(undefined, () => {
                    vscode.commands.executeCommand("workbench.action.tasks.configureTaskRunner");
                });
                break;
        }
    });
}

function activate(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand(RunTaskCommand, (args) => {
            switch (typeof args) {
                case "number":
                    const statusBar = statusBarArray[args - 1];
                    if (statusBar) {
                        const task = statusBar.command.arguments[0];
                        runTask(task);
                    }
                    else {
                        LOG(`Not found task #${args}`);
                    }
                    break;
                case "object":
                    runTask(args);
                    break;
                default:
                    LOG(`Invalid task: ${args}`);
                    break;
            }
        }),
        vscode.commands.registerCommand(SelectTaskCommand, () => {
            vscode.window.showQuickPick(selectList, { placeHolder: "Select task to execute" }).then(value => {
                if (value !== undefined) {
                    runTask(value.task);
                }
            })
        }),
        vscode.commands.registerCommand(OpenMenuCommand, openTasksMenu),
        vscode.commands.registerCommand(OpenSettingsCommand, () => {
            vscode.commands.executeCommand("workbench.action.openSettings", SettingsQuery);
        }),
        vscode.commands.registerCommand(ShowActionsCommand, showActionsMenu),
        vscode.commands.registerCommand(RefreshCommand, loadTasksWait),
        vscode.commands.registerCommand(ManageHiddenCommand, manageHiddenTasks),
        vscode.commands.registerCommand(ManageMenuHiddenCommand, () => manageHiddenTasksForView("menu")),
        vscode.commands.registerCommand(ManageListHiddenCommand, () => manageHiddenTasksForView("list")),
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("tasks.statusbar")) {
                const m = getDisplayMode();
                if (m === "menu" || m === "both") {
                    ensureMenuStatusBar();
                } else {
                    disposeMenuStatusBar();
                }
            }
            loadTasksWait();
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(loadTasksWait),
        vscode.tasks.onDidStartTask((e) => {
            refreshTask(e.execution.task);
        }),
        vscode.tasks.onDidEndTask((e) => {
            refreshTask(e.execution.task);
        })
    );
    loadTasksDelay(0);
}

exports.activate = activate;
exports.deactivate = deactivate;
