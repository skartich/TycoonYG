export class ObjectPool {
  constructor(createItem) {
    this.createItem = createItem;
    this.free = [];
    this.used = new Set();
  }

  acquire(...args) {
    const item = this.free.pop() ?? this.createItem();
    this.used.add(item);
    item.spawn?.(...args);
    return item;
  }

  release(item) {
    if (!item || !this.used.has(item)) return;
    this.used.delete(item);
    item.despawn?.();
    this.free.push(item);
  }

  clear() {
    [...this.used, ...this.free].forEach((item) => item.destroy?.());
    this.used.clear();
    this.free.length = 0;
  }
}
