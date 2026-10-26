// ali-oss 没有在 package.json 里声明 types 入口；这里只声明我们用到的最小形状，
// 具体调用由 lib/storage/oss.ts 内部的局部接口约束。
declare module "ali-oss" {
  const OSS: new (options: Record<string, unknown>) => unknown;
  export default OSS;
}
