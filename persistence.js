/* Persistent engine save directory. No engine/audio/input hooks required. */
'use strict';
window.DoomPersistence = function (module, status) {
  const fs = module.FS;
  const root = '/.savegame';
  let revision = 0;
  let persisted = 0;
  let syncing = false;
  let timer = null;
  let restoring = true;
  let waiters = [];

  function display(state, text) {
    status.dataset.state = state;
    status.textContent = text;
  }
  function isSave(path) {
    const cwd = fs.cwd();
    const absolute = new URL(path, 'file://' + (cwd.endsWith('/') ? cwd : cwd + '/')).pathname;
    return absolute === root || absolute.startsWith(root + '/');
  }
  function schedule() {
    if (timer === null && !syncing) timer = setTimeout(sync, 0);
  }
  function changed(path) {
    if (restoring || !isSave(path)) return;
    ++revision;
    display('pending', 'Saving to browser storage… Please wait before closing.');
    schedule();
  }
  function sync() {
    timer = null;
    if (syncing || revision === persisted) return;
    syncing = true;
    const target = revision;
    // Never overlap transactions. Changes made during this transaction trigger
    // another pass, including the engine's close/remove/rename save sequence.
    fs.syncfs(false, function (error) {
      syncing = false;
      if (error) {
        display('error', 'Save storage failed. Keep this tab open; retrying…');
        console.error('Persistent save sync failed:', error);
        timer = setTimeout(sync, 1000);
        return;
      }
      persisted = target;
      if (revision !== persisted) schedule();
      else {
        display('saved', 'Saves stored in this browser.');
        waiters.splice(0).forEach(resolve => resolve());
      }
    });
  }
  window.addEventListener('beforeunload', function (event) {
    // Async work cannot be guaranteed on unload. Writes are flushed immediately
    // during play instead; warn if the user leaves before a transaction commits.
    if (revision !== persisted) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  return {
    restore: function () {
      display('loading', 'Restoring browser saves…');
      fs.chdir('/'); // Engine configdir is '.', savegamedir is './.savegame/'.
      fs.mkdirTree(root);
      fs.mount(module.IDBFS, {}, root);
      return new Promise((resolve, reject) => {
        fs.syncfs(true, function (error) {
          if (error) {
            display('error', 'Browser save storage unavailable. Startup stopped to protect existing saves.');
            reject(error);
            return;
          }
          // FS_DEBUG enables these supported Emscripten tracking callbacks.
          // Hook only after population, so restoring never schedules a write.
          fs.trackingDelegate.onWriteToFile = changed;
          fs.trackingDelegate.onCloseFile = changed;
          fs.trackingDelegate.onMakeDirectory = changed;
          fs.trackingDelegate.onDeletePath = changed;
          fs.trackingDelegate.onMovePath = function (from, to) {
            changed(from);
            changed(to);
          };
          restoring = false;
          display('saved', 'Saves stored in this browser.');
          resolve();
        });
      });
    },
    // Diagnostics/tests can await a completed transaction, not just a timer.
    flush: function () {
      if (revision === persisted) return Promise.resolve();
      schedule();
      return new Promise(resolve => waiters.push(resolve));
    }
  };
};
