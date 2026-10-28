/**
 * 内置主题旅行模板：新建主题旅行时一键预置地点，之后可以继续增删。
 * 这里只放展示需要的数据，客户端和服务端都可以引用。
 */

export type TravelTemplatePlace = {
  name: string;
  region: string;
};

export type TravelTemplate = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  places: TravelTemplatePlace[];
};

export const TRAVEL_TEMPLATES: TravelTemplate[] = [
  {
    id: "museums",
    title: "全国博物馆打卡",
    subtitle: "把想去的馆，一个一个走完",
    description: "从国家级大馆到地方特色馆，去一个打一个卡，慢慢收集属于你家的博物馆地图。",
    places: [
      { name: "故宫博物院", region: "北京" },
      { name: "中国国家博物馆", region: "北京" },
      { name: "上海博物馆", region: "上海" },
      { name: "南京博物院", region: "南京" },
      { name: "陕西历史博物馆", region: "西安" },
      { name: "河南博物院", region: "郑州" },
      { name: "湖南博物院", region: "长沙" },
      { name: "湖北省博物馆", region: "武汉" },
      { name: "浙江省博物馆", region: "杭州" },
      { name: "山西博物院", region: "太原" },
      { name: "辽宁省博物馆", region: "沈阳" },
      { name: "四川博物院", region: "成都" },
      { name: "广东省博物馆", region: "广州" },
      { name: "山东博物馆", region: "济南" },
      { name: "苏州博物馆", region: "苏州" },
      { name: "三星堆博物馆", region: "德阳" },
    ],
  },
  {
    id: "shanxi-ancient-architecture",
    title: "山西省古建筑",
    subtitle: "中国古建筑的露天博物馆",
    description: "唐代木构、辽金巨刹、明清古城，山西的古建筑密度全国少见，适合按地区一块一块走。",
    places: [
      { name: "应县木塔", region: "朔州" },
      { name: "佛光寺", region: "忻州" },
      { name: "南禅寺", region: "忻州" },
      { name: "悬空寺", region: "大同" },
      { name: "云冈石窟", region: "大同" },
      { name: "华严寺", region: "大同" },
      { name: "善化寺", region: "大同" },
      { name: "晋祠", region: "太原" },
      { name: "平遥古城", region: "晋中" },
      { name: "双林寺", region: "晋中" },
      { name: "镇国寺", region: "晋中" },
      { name: "永乐宫", region: "运城" },
      { name: "广胜寺", region: "临汾" },
    ],
  },
  {
    id: "four-grottoes",
    title: "中国四大石窟探索",
    subtitle: "莫高窟 · 云冈 · 龙门 · 麦积山",
    description: "四大石窟横跨甘肃、山西、河南，每一处都值得专门安排一趟行程。",
    places: [
      { name: "莫高窟", region: "敦煌" },
      { name: "云冈石窟", region: "大同" },
      { name: "龙门石窟", region: "洛阳" },
      { name: "麦积山石窟", region: "天水" },
    ],
  },
  {
    id: "famous-mountains",
    title: "中国名山打卡",
    subtitle: "五岳和它们之外的山",
    description: "从五岳到雪山，体力好的先爬，体力一般的坐索道，重要的是都去过。",
    places: [
      { name: "泰山", region: "泰安" },
      { name: "华山", region: "渭南" },
      { name: "衡山", region: "衡阳" },
      { name: "恒山", region: "大同" },
      { name: "嵩山", region: "郑州" },
      { name: "黄山", region: "黄山" },
      { name: "庐山", region: "九江" },
      { name: "峨眉山", region: "乐山" },
      { name: "武当山", region: "十堰" },
      { name: "武夷山", region: "南平" },
      { name: "长白山", region: "延边" },
      { name: "玉龙雪山", region: "丽江" },
      { name: "九华山", region: "池州" },
      { name: "普陀山", region: "舟山" },
    ],
  },
  {
    id: "lakes",
    title: "中国湖泊打卡",
    subtitle: "高原的、江南的、北方的湖",
    description: "有的湖要坐很久的车才到，有的湖就在城市边上，去过一个就删一个，进度会自己涨。",
    places: [
      { name: "青海湖", region: "海北" },
      { name: "纳木错", region: "拉萨" },
      { name: "喀纳斯湖", region: "阿勒泰" },
      { name: "赛里木湖", region: "博尔塔拉" },
      { name: "长白山天池", region: "延边" },
      { name: "西湖", region: "杭州" },
      { name: "千岛湖", region: "杭州" },
      { name: "太湖", region: "无锡" },
      { name: "鄱阳湖", region: "上饶" },
      { name: "洞庭湖", region: "岳阳" },
      { name: "泸沽湖", region: "丽江" },
      { name: "洱海", region: "大理" },
      { name: "呼伦湖", region: "呼伦贝尔" },
      { name: "镜泊湖", region: "牡丹江" },
    ],
  },
  {
    id: "landmarks",
    title: "地标打卡",
    subtitle: "每座城市至少留下一个印记",
    description: "从城墙到塔尖，去过的城市在地标上打个卡，攒起来的是一次次出门的理由。",
    places: [
      { name: "天安门广场", region: "北京" },
      { name: "八达岭长城", region: "北京" },
      { name: "外滩", region: "上海" },
      { name: "东方明珠", region: "上海" },
      { name: "广州塔", region: "广州" },
      { name: "秦始皇兵马俑", region: "西安" },
      { name: "布达拉宫", region: "拉萨" },
      { name: "香港维多利亚港", region: "香港" },
      { name: "澳门大三巴牌坊", region: "澳门" },
      { name: "台北 101", region: "台北" },
      { name: "黄鹤楼", region: "武汉" },
      { name: "滕王阁", region: "南昌" },
      { name: "岳阳楼", region: "岳阳" },
      { name: "鼓浪屿", region: "厦门" },
      { name: "洪崖洞", region: "重庆" },
    ],
  },
];

export function findTravelTemplate(id: string): TravelTemplate | undefined {
  return TRAVEL_TEMPLATES.find((template) => template.id === id);
}
