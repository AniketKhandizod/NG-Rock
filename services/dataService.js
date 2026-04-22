/**
 * In-memory document store. Replace this module with a DB-backed implementation
 * (same public methods) when you add PostgreSQL, MongoDB, etc.
 */
const store = new Map();
let nextIndex = 1;

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
    return true;
}

/**
 * @param {number} index
 * @returns {boolean} true if deleted
 */
function remove(index) {
    if (!isPositiveIntegerId(index)) return false;
    return store.delete(index);
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

module.exports = {
    create,
    getAllIndexIds,
    getByIndex,
    getAllEntries,
    getAllAsObject,
    update,
    remove,
    size
};
