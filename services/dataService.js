/**
 * In-memory document store. Replace this module with a DB-backed implementation
 * (same public methods) when you add PostgreSQL, MongoDB, etc.
 */
const store = new Map();
let nextIndex = 1;
/** Last index that was created or updated (for “latest” metadata). */
let lastTouchedIndex = null;

function isPositiveIntegerId(n) {
    return Number.isInteger(n) && n > 0;
}

/**
 * @param {any} value Any JSON-serialisable value
 * @returns {number} index
 */
function create(value) {
    const id = nextIndex;
    nextIndex += 1;
    store.set(id, value);
    lastTouchedIndex = id;
    return id;
}

/**
 * @returns {number[]}
 */
function getAllIndexIds() {
    return [...store.keys()].sort((a, b) => a - b);
}

/**
 * @param {number} index
 * @returns {any|undefined}
 */
function getByIndex(index) {
    if (!isPositiveIntegerId(index)) return undefined;
    return store.get(index);
}

/**
 * @returns {Array<{ index: number, value: any }>}
 */
function getAllEntries() {
    return getAllIndexIds().map((index) => ({ index, value: store.get(index) }));
}

/**
 * @param {number} index
 * @param {any} value
 * @returns {boolean} true if updated
 */
function update(index, value) {
    if (!isPositiveIntegerId(index) || !store.has(index)) return false;
    store.set(index, value);
    lastTouchedIndex = index;
    return true;
}

/**
 * @param {number} index
 * @returns {boolean} true if deleted
 */
function remove(index) {
    if (!isPositiveIntegerId(index)) return false;
    const ok = store.delete(index);
    if (ok && lastTouchedIndex === index) {
        lastTouchedIndex = null;
    }
    return ok;
}

function size() {
    return store.size;
}

/**
 * @returns {Object.<string, any>} all records as plain object (for /data/all)
 */
function getAllAsObject() {
    const o = {};
    for (const [k, v] of store) {
        o[String(k)] = v;
    }
    return o;
}

/**
 * Highest index among rows that still exist; 0 if the store is empty.
 */
function getMaxIndex() {
    if (store.size === 0) return 0;
    return Math.max(...store.keys());
}

/**
 * Index most recently created or updated; null if none / was cleared.
 */
function getLatestUpdatedIndex() {
    if (lastTouchedIndex == null) return null;
    return store.has(lastTouchedIndex) ? lastTouchedIndex : null;
}

/**
 * Next index that POST will assign.
 */
function getNextIndex() {
    return nextIndex;
}

/**
 * Remove every record and reset auto-increment.
 */
function clearAll() {
    store.clear();
    nextIndex = 1;
    lastTouchedIndex = null;
    return true;
}

module.exports = {
    create,
    getAllIndexIds,
    getByIndex,
    getAllEntries,
    getAllAsObject,
    update,
    remove,
    size,
    getMaxIndex,
    getLatestUpdatedIndex,
    getNextIndex,
    clearAll
};
