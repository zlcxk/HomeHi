/**
 * 内置主题旅行模板：新建主题旅行时一键预置地点/事项，之后可以继续增删。
 * 这里只放展示需要的数据，客户端和服务端都可以引用。
 */

export type TravelTemplatePlace = {
  name: string;
  region: string;
};

export type TravelTemplateCategory = {
  name: string;
  /** 固定 10 条，顺序即模板编号顺序 */
  items: string[];
};

export type TravelTemplate = {
  id: string;
  /** 默认封面，放在 public/travel/covers 下 */
  cover: string;
  title: string;
  subtitle: string;
  description: string;
  /** 传统地点型模板：平铺地点，不分类 */
  places?: TravelTemplatePlace[];
  /** 事项型模板：按分类组织的事项 */
  categories?: TravelTemplateCategory[];
};

/** 初始化到 TripPlace 时使用的一行。 */
export type TravelTemplateEntry = {
  name: string;
  region: string;
  category: string | null;
  sortOrder: number;
};

export const TRAVEL_TEMPLATES: TravelTemplate[] = [
  {
    id: "museums",
    cover: "/travel/covers/museums.svg",
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
    cover: "/travel/covers/shanxi-ancient-architecture.svg",
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
    cover: "/travel/covers/four-grottoes.svg",
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
    cover: "/travel/covers/famous-mountains.svg",
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
    cover: "/travel/covers/lakes.svg",
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
    cover: "/travel/covers/landmarks.svg",
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
  {
    id: "couple-budget-100",
    cover: "/travel/covers/couple-budget-100.svg",
    title: "普通预算情侣的 100 件小事",
    subtitle: "不用花很多钱，也能一起完成很多事",
    description:
      "不需要昂贵的消费，也不需要刻意制造浪漫。用普通的预算，在日常生活和旅行中，一起完成 100 件值得记住的小事。",
    categories: [
      {
        name: "日常生活",
        items: [
          "一起做一顿双人晚餐",
          "把手机放到一边，聊一个晚上",
          "一起逛超市，买一周的食材",
          "在家布置一个舒服的阅读角",
          "挑一部老电影，窝在沙发看完",
          "一起大扫除，把房间收拾干净",
          "给对方做一次早餐",
          "记录彼此一天的作息和小习惯",
          "一起养一盆植物并照顾它",
          "在家中拍一组生活合照",
        ],
      },
      {
        name: "城市探索",
        items: [
          "走完一条没去过的老街",
          "在城市最高的地方看一次日落",
          "逛一次早市，吃当地早餐",
          "坐一趟从没坐过的公交线",
          "去城市公园野餐",
          "逛夜市，从头吃到尾",
          "打卡城市里的一家独立书店",
          "找一条河或江边散步到天黑",
          "去老城区拍一组街景",
          "随机选一站地铁下车探索",
        ],
      },
      {
        name: "自然与户外",
        items: [
          "一起爬一座不高的山",
          "在郊外露营一晚",
          "找一片草地野餐",
          "沿着河边或海边骑行",
          "去公园放一次风筝",
          "在天气好的晚上看星星",
          "早起看一次日出",
          "雨中散步，听一次雨声",
          "去郊外摘一次水果",
          "一起走完一条徒步路线",
        ],
      },
      {
        name: "美食体验",
        items: [
          "吃遍一条小吃街",
          "在家煮一次火锅",
          "一起学做一道新菜",
          "去一家开了很多年的老店",
          "一起烤一次蛋糕或饼干",
          "尝试一种没吃过的水果",
          "互相给对方点一份外卖",
          "去菜市场买食材做一顿饭",
          "一起包一次饺子",
          "找一家小店吃到打烊",
        ],
      },
      {
        name: "旅行与纪念",
        items: [
          "来一次说走就走的周边游",
          "去邻近城市过周末",
          "一起逛一次博物馆",
          "坐绿皮火车去一个陌生小城",
          "为一次旅行做一本相册",
          "在旅行地寄一张明信片回家",
          "住一次有特色的民宿",
          "一起规划一条两天一夜的路线",
          "在旅行中拍一张同款合照",
          "把车票和门票收进纪念盒",
        ],
      },
      {
        name: "娱乐与体验",
        items: [
          "玩一整晚的桌游",
          "去 KTV 合唱一首歌",
          "去游乐园坐一次过山车",
          "一起做一次手工陶艺",
          "去电玩城比赛抓娃娃",
          "看一场现场演出或脱口秀",
          "一起拼完一幅拼图",
          "去密室逃脱合作解谜",
          "逛一次漫展或市集",
          "一起学一支简单的舞",
        ],
      },
      {
        name: "浪漫与仪式感",
        items: [
          "给对方手写一封信",
          "认真过一次纪念日",
          "准备一次不花钱的小惊喜",
          "拍一组情侣合照",
          "一起看一次跨年烟花",
          "交换一件有故事的小礼物",
          "在普通的日子送一束花",
          "复刻第一次约会的路线",
          "为对方读一段喜欢的文字",
          "每年在同一天拍一张合照",
        ],
      },
      {
        name: "运动与挑战",
        items: [
          "每天一起散步半小时",
          "一起完成一次 5 公里跑",
          "打一场羽毛球",
          "学会一项新的运动",
          "一起做一次 30 天运动打卡",
          "骑共享单车穿过一座城",
          "去游泳馆游一次泳",
          "挑战一次户外攀爬",
          "一起参加一场趣味运动会",
          "互相监督完成一次体能目标",
        ],
      },
      {
        name: "学习与成长",
        items: [
          "一起读完同一本书",
          "学会用相机拍人像",
          "一起入门一门外语",
          "报名一门线上课程并学完",
          "互相教对方一项技能",
          "一起做一次读书分享",
          "学会一道对方家乡的菜",
          "一起整理一份学习计划",
          "去看一场讲座或分享会",
          "用一个月养成一个新习惯",
        ],
      },
      {
        name: "回忆与未来",
        items: [
          "一起整理手机里的照片",
          "制作一条共同生活时间线",
          "写下 100 件想一起做的事",
          "录一段给未来彼此的语音",
          "整理一次共同的账本和票据",
          "给一年后的自己写一封信",
          "选一首属于两个人的歌",
          "做一本只属于两个人的年鉴",
          "规划一次一年后的旅行",
          "聊一次关于未来的生活设想",
        ],
      },
    ],
  },
  {
    id: "couple-premium-100",
    cover: "/travel/covers/couple-premium-100.svg",
    title: "经济条件不错的情侣 100 件事",
    subtitle: "去更远的地方，体验更好的生活",
    description:
      "一起去更远的地方，尝试新的生活方式，体验不同的文化，享受美食与旅行，也为未来留下共同的回忆。",
    categories: [
      {
        name: "高品质旅行",
        items: [
          "去一次海岛度假",
          "在雪山脚下的酒店住一晚",
          "订一次全程定制的旅行",
          "坐一次商务舱去旅行",
          "住一次有设计感的精品酒店",
          "跨城去看一场喜欢的演出",
          "来一次没有行程表的度假",
          "在异国城市住满一周",
          "体验一次私人导游讲解",
          "一起规划一次年度长途旅行",
        ],
      },
      {
        name: "自然与独特体验",
        items: [
          "坐一次热气球看日出",
          "一起潜水看海底世界",
          "去滑雪场滑一次雪",
          "追一次极光",
          "包一艘游艇出海",
          "在沙漠里看一次星空",
          "去雨林徒步探险",
          "体验一次直升机观光",
          "在冰川上走一段路",
          "去火山口看一次地貌",
        ],
      },
      {
        name: "精致美食",
        items: [
          "吃一次米其林餐厅",
          "体验一次 Omakase",
          "参加一次葡萄酒品鉴",
          "去产地吃一次当季食材",
          "订一桌主厨私宴",
          "一起学做一道高级料理",
          "吃一次需要提前很久预约的餐厅",
          "在海边吃一顿落日晚餐",
          "体验一次威士忌品鉴",
          "去不同城市吃各自的招牌菜",
        ],
      },
      {
        name: "浪漫与纪念",
        items: [
          "安排一次周年旅行",
          "拍一组高质量情侣写真",
          "交换一件有纪念意义的礼物",
          "订一次纪念日晚宴",
          "在特别的日子包场看一场电影",
          "为对方准备一次惊喜旅行",
          "定制一对属于两个人的饰品",
          "在旅行地办一次小型纪念仪式",
          "每年写一封只给对方看的信",
          "一起拍一支纪念短片",
        ],
      },
      {
        name: "文化与艺术",
        items: [
          "逛一次世界级博物馆",
          "看一场音乐剧",
          "听一场交响乐演出",
          "参加一次艺术展",
          "去一次艺术拍卖预展",
          "看一场芭蕾舞演出",
          "参加一次文化节",
          "去剧院看一场经典话剧",
          "一起上一堂艺术鉴赏课",
          "收藏一件两个人都喜欢的艺术品",
        ],
      },
      {
        name: "运动与生活方式",
        items: [
          "一起泡一次温泉",
          "打一场高尔夫",
          "体验一次帆船出海",
          "去马场学一次骑马",
          "体验一次私人健身课程",
          "去海边冲一次浪",
          "参加一次马拉松或越野赛",
          "体验一次滑雪度假",
          "一起练一段时间的普拉提",
          "安排一次健康度假",
        ],
      },
      {
        name: "兴趣与共同成长",
        items: [
          "一起学一门外语",
          "报一门摄影进阶课",
          "体验一次陶艺创作",
          "学一次调酒",
          "一起上花艺课",
          "学一次咖啡烘焙",
          "一起完成一门商业课程",
          "体验一次香水调配",
          "学一次绘画或版画",
          "共同完成一个兴趣作品",
        ],
      },
      {
        name: "特别约会",
        items: [
          "包场看一次私人电影",
          "在酒店过一个周末",
          "体验一次双人 SPA",
          "安排一次惊喜约会",
          "在屋顶餐厅吃一顿晚餐",
          "一起参加一次品酒晚宴",
          "去听一场小型现场音乐",
          "安排一次城市里的短途度假",
          "体验一次私人厨师上门",
          "认真准备一次告白式约会",
        ],
      },
      {
        name: "生活与未来",
        items: [
          "一起设计理想中的居住空间",
          "建立一笔共同基金",
          "做一次长期生活规划",
          "一起完成一个长期项目",
          "共同制定一份年度预算",
          "选一个城市体验长期居住",
          "一起配置一份家庭保障计划",
          "为共同的兴趣设一个专项账户",
          "一起整理一份家庭资产清单",
          "聊清楚未来五年的生活方向",
        ],
      },
      {
        name: "人生特别体验",
        items: [
          "在海外生活一段时间",
          "坐一次长途邮轮",
          "完成一次跨洲旅行",
          "去南极或北极旅行一次",
          "在异国过一次春节",
          "完成一次环球航线中的一段",
          "去现场看一次世界级赛事",
          "参加一次国际文化盛会",
          "一起完成一次公益旅行",
          "实现一个共同的人生愿望",
        ],
      },
    ],
  },
];

export function findTravelTemplate(id: string): TravelTemplate | undefined {
  return TRAVEL_TEMPLATES.find((template) => template.id === id);
}

/** 模板里的分类顺序。传统地点模板没有分类，返回空数组。 */
export function templateCategoryNames(template: TravelTemplate): string[] {
  return template.categories?.map((category) => category.name) ?? [];
}

/** 模板事项/地点总数。 */
export function templateItemCount(template: TravelTemplate): number {
  if (template.categories) {
    return template.categories.reduce((sum, category) => sum + category.items.length, 0);
  }
  return template.places?.length ?? 0;
}

/**
 * 展平模板，供初始化 TripPlace 使用。
 * 分类模板按「分类顺序 × 10」生成稳定的 sortOrder；地点模板沿用原顺序。
 */
export function templateEntries(template: TravelTemplate): TravelTemplateEntry[] {
  if (template.categories) {
    return template.categories.flatMap((category, categoryIndex) =>
      category.items.map((name, itemIndex) => ({
        name,
        region: "",
        category: category.name,
        sortOrder: categoryIndex * 10 + itemIndex,
      })),
    );
  }
  return (template.places ?? []).map((place, index) => ({
    name: place.name,
    region: place.region,
    category: null,
    sortOrder: index,
  }));
}

/** 模板是否按分类展示事项。 */
export function isCategorizedTemplate(template: TravelTemplate | undefined): boolean {
  return Boolean(template?.categories?.length);
}
