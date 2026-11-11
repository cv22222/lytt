const localJournal = (() => {
  const key = 'journal.v1:' + new URL('.', location.href).pathname;
  const visitsKey = key + ':visits';
  async function read() {
    const stored = localStorage.getItem(key);
    if (stored !== null) return JSON.parse(stored);
    const response = await fetch('sample.json');
    if (!response.ok) throw Error('示例内容加载失败，请刷新重试。');
    const data = await response.json();
    return {...data, entries: data.entries.map(e => ({...e, published: 1}))};
  }
  async function change(edit) {
    const write = async () => {
      const data = await read();
      edit(data);
      localStorage.setItem(key, JSON.stringify(data));
    };
    if (navigator.locks) await navigator.locks.request(key, write);
    else await write();
  }
  function visits() { return JSON.parse(localStorage.getItem(visitsKey) || '[]'); }
  function visit(page) {
    try {
      const recent = [{at: new Date().toISOString(), page}, ...visits()].slice(0,200);
      localStorage.setItem(visitsKey, JSON.stringify(recent));
    } catch { /* Reading remains available when history storage is full. */ }
  }
  return {read, change, visits, visit};
})();
