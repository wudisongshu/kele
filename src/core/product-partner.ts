/**
 * Product Partner — analyzes competitors, designs monetization, and architects virality.
 *
 * When a user has an idea, the Product Partner:
 * 1. Looks up known competitors from the mock database
 * 2. Designs a monetization strategy matched to the platform + game type
 * 3. Architects viral mechanics (share triggers, referral loops, social proof)
 * 4. Estimates a success rate based on competition density + monetization fit
 *
 * All analysis is deterministic (zero AI cost) using keyword matching against
 * a curated competitor database of 50+ products.
 */

export interface CompetitorProfile {
  name: string;
  category: string;
  revenueModel: string;
  keyFeatures: string[];
  viralityMechanics: string[];
  estimatedMonthlyRevenue: string;
  keywords: string[];
}

export interface MonetizationStrategy {
  primary: string;
  secondary: string[];
  adPlacements: string[];
  iapItems: string[];
  estimatedArpu: string;
  estimatedLtv: string;
  platformFit: number; // 0-100
}

export interface ViralityDesign {
  shareTriggers: string[];
  referralRewards: string[];
  socialProofMechanics: string[];
  viralLoopDescription: string;
  estimatedKFactor: number; // viral coefficient estimate
}

export interface ProductPartnerReport {
  competitorAnalysis: CompetitorProfile[];
  monetizationStrategy: MonetizationStrategy;
  viralityDesign: ViralityDesign;
  differentiationUsp: string;
  estimatedSuccessRate: number; // 0-100
  actionableRecommendations: string[];
}

/* ──────────────────────────────────────────────
   Mock Competitor Database (50+ entries)
   ────────────────────────────────────────────── */

const MOCK_COMPETITORS: CompetitorProfile[] = [
  // Match-3 / Puzzle
  { name: 'Candy Crush Saga', category: 'match-3', revenueModel: 'IAP + 广告', keyFeatures: ['颜色匹配', '连击特效', '关卡地图', '生命系统', '好友求助'], viralityMechanics: ['Facebook 好友送生命', '关卡进度分享', '排行榜竞争'], estimatedMonthlyRevenue: '$100M+', keywords: ['消消乐', 'match-3', 'candy', '消除', 'puzzle'] },
  { name: 'Bejeweled', category: 'match-3', revenueModel: '付费下载 + IAP', keyFeatures: ['宝石交换', '时间模式', '无尽模式', '连击加分'], viralityMechanics: ['高分分享', '成就截图'], estimatedMonthlyRevenue: '$5M+', keywords: ['bejeweled', '宝石', '消除', 'match'] },
  { name: 'Gardenscapes', category: 'match-3', revenueModel: 'IAP + 广告', keyFeatures: ['装修+消除', '剧情驱动', '角色互动', '花园设计'], viralityMechanics: ['花园截图分享', '好友帮忙', '活动竞赛'], estimatedMonthlyRevenue: '$80M+', keywords: ['gardenscapes', '装修', '消除', '花园'] },
  { name: 'Homescapes', category: 'match-3', revenueModel: 'IAP + 广告', keyFeatures: ['房屋装修', '家庭剧情', '消除玩法', '角色对话'], viralityMechanics: ['装修成果分享', '好友排行榜'], estimatedMonthlyRevenue: '$60M+', keywords: ['homescapes', '装修', '房屋', '消除'] },
  { name: 'Toon Blast', category: 'match-3', revenueModel: 'IAP + 广告', keyFeatures: ['方块消除', '卡通风格', '道具组合', '团队竞赛'], viralityMechanics: ['团队邀请', '团队排行榜', '关卡分享'], estimatedMonthlyRevenue: '$30M+', keywords: ['toon blast', '方块', '消除', 'blast'] },

  // Tower Defense
  { name: 'Bloons TD 6', category: 'tower-defense', revenueModel: '付费下载 + IAP', keyFeatures: ['猴子塔', '英雄系统', '升级路径', '合作模式', '挑战模式'], viralityMechanics: ['合作模式邀请', '挑战分享', '成就展示'], estimatedMonthlyRevenue: '$10M+', keywords: ['bloons', 'td', '塔防', 'tower defense', '猴子'] },
  { name: 'Kingdom Rush', category: 'tower-defense', revenueModel: '付费下载 + IAP', keyFeatures: ['英雄控制', '兵营塔', '技能系统', '漫画风格'], viralityMechanics: ['关卡评分分享', 'Iron 挑战分享'], estimatedMonthlyRevenue: '$3M+', keywords: ['kingdom rush', '塔防', '王国'] },
  { name: 'Plants vs. Zombies', category: 'tower-defense', revenueModel: '付费下载 + IAP + 广告', keyFeatures: ['植物种植', '僵尸种类', '阳光经济', '花园模式'], viralityMechanics: ['花园展示', '成就分享'], estimatedMonthlyRevenue: '$5M+', keywords: ['pvz', '植物大战僵尸', '塔防', 'zombie'] },
  { name: 'Clash Royale', category: 'tower-defense', revenueModel: 'IAP + Pass', keyFeatures: ['实时对战', '卡牌收集', '部落系统', '赛季通行证'], viralityMechanics: ['部落邀请', '对战回放分享', '锦标赛分享'], estimatedMonthlyRevenue: '$50M+', keywords: ['clash royale', '皇室战争', '卡牌', '对战'] },
  { name: 'Bloons TD Battles 2', category: 'tower-defense', revenueModel: 'IAP + Pass', keyFeatures: ['PVP 塔防', '排位系统', '皮肤系统', '联赛'], viralityMechanics: ['对战邀请', '段位分享', '赛季排名'], estimatedMonthlyRevenue: '$5M+', keywords: ['btd battles', '塔防', '对战'] },

  // Arcade / Casual
  { name: 'Flappy Bird', category: 'arcade', revenueModel: '广告', keyFeatures: ['单指操作', '像素风', '极简设计', '难度递增'], viralityMechanics: ['分数截图分享', '好友挑战', '病毒传播'], estimatedMonthlyRevenue: '$50K/天 (peak)', keywords: ['flappy', '像素', 'arcade', '飞鸟'] },
  { name: 'Subway Surfers', category: 'endless-runner', revenueModel: 'IAP + 广告', keyFeatures: ['无尽跑酷', '全球旅行主题', '角色收集', '滑板道具'], viralityMechanics: ['分数分享', '角色展示', '活动挑战'], estimatedMonthlyRevenue: '$30M+', keywords: ['subway surfers', '跑酷', 'endless runner', '地铁'] },
  { name: 'Temple Run', category: 'endless-runner', revenueModel: 'IAP + 广告', keyFeatures: ['3D 跑酷', '倾斜控制', '角色解锁', '能力提升'], viralityMechanics: ['高分分享', '角色展示'], estimatedMonthlyRevenue: '$5M+', keywords: ['temple run', '神庙逃亡', '跑酷'] },
  { name: 'Crossy Road', category: 'arcade', revenueModel: 'IAP + 广告', keyFeatures: ['过马路', ' voxel 风格', '角色收集', '双人模式'], viralityMechanics: ['角色解锁分享', '双人同屏', '搞笑死亡截图'], estimatedMonthlyRevenue: '$3M+', keywords: ['crossy road', '过马路', 'voxel'] },
  { name: 'Fruit Ninja', category: 'arcade', revenueModel: 'IAP + 广告', keyFeatures: ['切水果', '连击系统', '多种模式', '道场背景'], viralityMechanics: ['分数分享', '连击截图'], estimatedMonthlyRevenue: '$2M+', keywords: ['fruit ninja', '切水果', '忍者'] },
  { name: 'Geometry Dash', category: 'arcade', revenueModel: '付费下载 + IAP', keyFeatures: ['节奏跳跃', '关卡编辑器', '自定义皮肤', '高难度'], viralityMechanics: ['自制关卡分享', '通关视频', '社区关卡'], estimatedMonthlyRevenue: '$2M+', keywords: ['geometry dash', '节奏', '跳跃', '几何'] },
  { name: 'Angry Birds', category: 'arcade', revenueModel: 'IAP + 广告 + 授权', keyFeatures: ['弹弓物理', '破坏评分', '角色能力', '星级系统'], viralityMechanics: ['三星截图', '关卡分享', '好友挑战'], estimatedMonthlyRevenue: '$10M+', keywords: ['angry birds', '愤怒的小鸟', '弹弓'] },
  { name: 'Doodle Jump', category: 'arcade', revenueModel: 'IAP + 广告', keyFeatures: ['涂鸦风格', '重力感应', '平台跳跃', '道具'], viralityMechanics: ['分数分享'], estimatedMonthlyRevenue: '$500K+', keywords: ['doodle jump', '涂鸦', '跳跃'] },
  { name: 'Helix Jump', category: 'arcade', revenueModel: '广告 + IAP', keyFeatures: ['螺旋塔', '下落击碎', '彩色平台', '简单上手'], viralityMechanics: ['关卡进度分享', '高分挑战'], estimatedMonthlyRevenue: '$5M+', keywords: ['helix jump', '螺旋', '下落'] },
  { name: 'Paper.io', category: 'arcade', revenueModel: '广告 + IAP', keyFeatures: ['圈地玩法', 'IO 对战', '皮肤收集', '领地竞争'], viralityMechanics: ['领地百分比分享', '对战邀请'], estimatedMonthlyRevenue: '$3M+', keywords: ['paper.io', '圈地', 'io'] },

  // Platformer
  { name: 'Super Mario Run', category: 'platformer', revenueModel: '付费下载 + IAP', keyFeatures: ['自动奔跑', '单手操作', '王国建造', '拉力赛对战'], viralityMechanics: ['拉力赛对战', '王国展示'], estimatedMonthlyRevenue: '$3M+', keywords: ['mario', '马里奥', 'platformer'] },
  { name: 'Geometry Dash (Platformer)', category: 'platformer', revenueModel: '付费下载 + IAP', keyFeatures: ['节奏平台', '关卡编辑器', '社区关卡'], viralityMechanics: ['自制关卡分享', '通关视频'], estimatedMonthlyRevenue: '$2M+', keywords: ['geometry dash', '平台', '节奏'] },
  { name: 'Ori and the Blind Forest', category: 'platformer', revenueModel: '付费下载', keyFeatures: ['精美画面', '情感叙事', '能力解锁', 'Metroidvania'], viralityMechanics: ['画面截图分享', '情感共鸣传播'], estimatedMonthlyRevenue: '$1M+', keywords: ['ori', '平台', '独立游戏'] },
  { name: 'Celeste', category: 'platformer', revenueModel: '付费下载', keyFeatures: ['高难度平台', '像素风格', '辅助模式', '章节式'], viralityMechanics: ['速通挑战', '成就分享'], estimatedMonthlyRevenue: '$500K+', keywords: ['celeste', '平台', '像素'] },
  { name: 'Hollow Knight', category: 'platformer', revenueModel: '付费下载', keyFeatures: ['类银河恶魔城', '手绘风格', 'Boss 战', '探索'], viralityMechanics: ['Boss 战视频', '地图探索分享'], estimatedMonthlyRevenue: '$2M+', keywords: ['hollow knight', '空洞骑士', '银河恶魔城'] },

  // Puzzle / Brain
  { name: '2048', category: 'puzzle', revenueModel: '广告', keyFeatures: ['数字合并', '滑动操作', '极简设计', '无尽玩法'], viralityMechanics: ['最高分分享', '分数截图'], estimatedMonthlyRevenue: '$100K+', keywords: ['2048', '数字', '合并', 'puzzle'] },
  { name: 'Wordle', category: 'puzzle', revenueModel: '订阅 (NYT)', keyFeatures: ['每日一词', '6次猜测', '颜色反馈', '社交分享'], viralityMechanics: ['结果方块分享 (🟩🟨⬜)', '每日挑战', '病毒传播'], estimatedMonthlyRevenue: 'N/A (收购)', keywords: ['wordle', '猜词', 'word', '文字'] },
  { name: 'Monument Valley', category: 'puzzle', revenueModel: '付费下载 + IAP', keyFeatures: ['视错觉', '极简美学', '触屏操作', '叙事'], viralityMechanics: ['画面截图', '视错觉分享'], estimatedMonthlyRevenue: '$1M+', keywords: ['monument valley', '纪念碑谷', '视错觉'] },
  { name: 'Sudoku', category: 'puzzle', revenueModel: '广告 + IAP', keyFeatures: ['数字填充', '难度分级', '笔记功能', '每日挑战'], viralityMechanics: ['每日挑战分享', '连胜记录'], estimatedMonthlyRevenue: '$500K+', keywords: ['sudoku', '数独', '数字'] },
  { name: 'Tetris', category: 'puzzle', revenueModel: 'IAP + 订阅 + 广告', keyFeatures: ['方块堆叠', '消除行', '速度递增', '多人对战'], viralityMechanics: ['高分分享', '对战邀请'], estimatedMonthlyRevenue: '$5M+', keywords: ['tetris', '俄罗斯方块', '方块'] },

  // Strategy / RPG
  { name: 'Clash of Clans', category: 'strategy', revenueModel: 'IAP', keyFeatures: ['村庄建设', '部落战争', '兵种升级', '联赛系统'], viralityMechanics: ['部落邀请', '战争回放', '联赛排名'], estimatedMonthlyRevenue: '$50M+', keywords: ['clash of clans', '部落冲突', '策略', 'coc'] },
  { name: 'Raid: Shadow Legends', category: 'rpg', revenueModel: 'IAP + 广告', keyFeatures: ['回合制 RPG', '英雄收集', '装备系统', '公会战'], viralityMechanics: ['英雄展示', '抽卡分享', '公会招募'], estimatedMonthlyRevenue: '$40M+', keywords: ['raid', 'rpg', '回合制'] },
  { name: 'AFK Arena', category: 'rpg', revenueModel: 'IAP + Pass', keyFeatures: ['放置玩法', '英雄羁绊', '挂机收益', '多阵容'], viralityMechanics: ['英雄阵容分享', '公会邀请'], estimatedMonthlyRevenue: '$20M+', keywords: ['afk arena', '放置', '挂机', '剑与远征'] },
  { name: 'Genshin Impact', category: 'rpg', revenueModel: 'IAP (gacha)', keyFeatures: ['开放世界', '元素反应', '角色抽卡', '多人合作'], viralityMechanics: ['抽卡结果分享', '角色展示', '风景截图', '攻略分享'], estimatedMonthlyRevenue: '$100M+', keywords: ['genshin', '原神', 'gacha', '开放世界'] },
  { name: 'Pokémon GO', category: 'rpg', revenueModel: 'IAP + 广告', keyFeatures: ['AR 捕捉', '位置游戏', '道馆对战', '团队系统'], viralityMechanics: ['稀有精灵分享', '道馆占领', '活动聚会', '社交狩猎'], estimatedMonthlyRevenue: '$30M+', keywords: ['pokemon go', '宝可梦', 'ar', '位置'] },

  // Racing
  { name: 'Asphalt 9', category: 'racing', revenueModel: 'IAP + Pass', keyFeatures: ['街机赛车', '氮气加速', '车辆收集', '多人联赛'], viralityMechanics: ['车辆展示', '联赛排名', '俱乐部邀请'], estimatedMonthlyRevenue: '$10M+', keywords: ['asphalt', '狂野飙车', '赛车', 'racing'] },
  { name: 'Mario Kart Tour', category: 'racing', revenueModel: 'IAP + Pass', keyFeatures: ['道具赛车', '角色车辆滑翔翼', '巡回赛', '多人对战'], viralityMechanics: ['对战邀请', '高分分享'], estimatedMonthlyRevenue: '$5M+', keywords: ['mario kart', '赛车', '卡丁车'] },
  { name: 'Hill Climb Racing', category: 'racing', revenueModel: '广告 + IAP', keyFeatures: ['物理驾驶', '车辆升级', '地形挑战', '简单操作'], viralityMechanics: ['距离分享', '车辆展示'], estimatedMonthlyRevenue: '$2M+', keywords: ['hill climb', '登山赛车', '物理'] },
  { name: 'CSR Racing 2', category: 'racing', revenueModel: 'IAP', keyFeatures: ['直线加速', '车辆改装', '车队系统', '实时对战'], viralityMechanics: ['车辆展示', '车队邀请', '对战邀请'], estimatedMonthlyRevenue: '$10M+', keywords: ['csr racing', '直线加速', '改装'] },

  // Shooter / Action
  { name: 'PUBG Mobile', category: 'shooter', revenueModel: 'IAP + Pass', keyFeatures: ['大逃杀', '百人同局', '载具系统', '排位赛'], viralityMechanics: ['战绩分享', '击杀集锦', '组队邀请', '直播'], estimatedMonthlyRevenue: '$80M+', keywords: ['pubg', '吃鸡', '大逃杀', 'battle royale'] },
  { name: 'Among Us', category: 'social', revenueModel: 'IAP + 广告 + 授权', keyFeatures: ['社交推理', '内鬼机制', '语音聊天', '自定义房间'], viralityMechanics: ['房间码分享', '搞笑时刻视频', '直播', 'Meme 传播'], estimatedMonthlyRevenue: '$5M+', keywords: ['among us', '狼人杀', '社交', '推理'] },
  { name: 'Brawl Stars', category: 'shooter', revenueModel: 'IAP + Pass', keyFeatures: ['3v3 对战', '英雄收集', '多种模式', '俱乐部'], viralityMechanics: ['俱乐部邀请', '对战回放', '活动分享'], estimatedMonthlyRevenue: '$20M+', keywords: ['brawl stars', '荒野乱斗', '对战'] },
  { name: 'Call of Duty Mobile', category: 'shooter', revenueModel: 'IAP + Pass', keyFeatures: ['FPS', '大逃杀', '多人对战', '赛季通行证'], viralityMechanics: ['战绩分享', '组队邀请', '赛季排名'], estimatedMonthlyRevenue: '$30M+', keywords: ['cod mobile', '使命召唤', 'fps'] },

  // Card / Board
  { name: 'Hearthstone', category: 'card', revenueModel: 'IAP + Pass', keyFeatures: ['卡牌对战', '英雄技能', '扩展包', '酒馆战棋'], viralityMechanics: ['卡组分享', '对战回放', '直播'], estimatedMonthlyRevenue: '$20M+', keywords: ['hearthstone', '炉石传说', '卡牌'] },
  { name: 'Yu-Gi-Oh! Duel Links', category: 'card', revenueModel: 'IAP', keyFeatures: ['简化规则', '角色技能', '卡组构建', 'PvP'], viralityMechanics: ['卡组分享', '对战邀请'], estimatedMonthlyRevenue: '$5M+', keywords: ['yugioh', '游戏王', '卡牌'] },
  { name: 'UNO', category: 'card', revenueModel: 'IAP + 广告', keyFeatures: ['经典玩法', '2v2 模式', '自定义规则', '主题牌组'], viralityMechanics: ['房间邀请', '搞笑时刻分享'], estimatedMonthlyRevenue: '$3M+', keywords: ['uno', '纸牌', '卡牌'] },
  { name: 'Chess.com', category: 'board', revenueModel: '订阅 + IAP', keyFeatures: ['在线对弈', 'Puzzle', '课程', '联赛'], viralityMechanics: ['对局分享', 'Puzzle 挑战', '段位展示'], estimatedMonthlyRevenue: '$10M+', keywords: ['chess', '国际象棋', '棋'] },
  { name: 'Monopoly GO', category: 'board', revenueModel: 'IAP + 广告', keyFeatures: ['骰子棋盘', '地产建设', '好友互动', '活动'], viralityMechanics: ['好友互助', '骰子赠送', '活动邀请'], estimatedMonthlyRevenue: '$100M+', keywords: ['monopoly', '大富翁', '棋盘'] },

  // Simulation / Sandbox
  { name: 'Minecraft', category: 'sandbox', revenueModel: '付费下载 + 订阅 (Realms)', keyFeatures: ['方块建造', '生存模式', '红石电路', '多人服务器'], viralityMechanics: ['建筑截图', '服务器邀请', 'YouTube 视频', '直播', '模组分享'], estimatedMonthlyRevenue: '$30M+', keywords: ['minecraft', '我的世界', '沙盒'] },
  { name: 'Roblox', category: 'sandbox', revenueModel: 'IAP (Robux)', keyFeatures: ['用户创作游戏', '虚拟形象', '社交', '开发工具'], viralityMechanics: ['游戏邀请', '创作分享', '虚拟商品展示', '直播'], estimatedMonthlyRevenue: '$200M+', keywords: ['roblox', '罗布乐思', '创作'] },
  { name: 'Stardew Valley', category: 'simulation', revenueModel: '付费下载', keyFeatures: ['农场经营', '社交恋爱', '钓鱼采矿', '季节系统'], viralityMechanics: ['农场截图', '成就分享', '攻略分享'], estimatedMonthlyRevenue: '$2M+', keywords: ['stardew', '星露谷', '农场'] },
  { name: 'The Sims Mobile', category: 'simulation', revenueModel: 'IAP + 广告', keyFeatures: ['虚拟人生', '房屋装修', '社交互动', '职业发展'], viralityMechanics: ['房屋展示', '角色展示', '故事分享'], estimatedMonthlyRevenue: '$5M+', keywords: ['sims', '模拟人生', '虚拟'] },

  // Music / Rhythm
  { name: 'Piano Tiles', category: 'rhythm', revenueModel: '广告 + IAP', keyFeatures: ['钢琴块点击', '经典曲目', '速度递增', '对战模式'], viralityMechanics: ['分数分享', '对战邀请'], estimatedMonthlyRevenue: '$2M+', keywords: ['piano tiles', '钢琴块', '节奏'] },
  { name: 'Beat Saber', category: 'rhythm', revenueModel: '付费下载 + DLC', keyFeatures: ['VR 光剑', '节奏切割', '自定义歌曲', '健身'], viralityMechanics: ['游玩视频', '高分分享', '自定义谱面'], estimatedMonthlyRevenue: '$3M+', keywords: ['beat saber', '节奏光剑', 'vr'] },
  { name: 'osu!', category: 'rhythm', revenueModel: '捐赠 + 订阅', keyFeatures: ['点击/拖拽/旋转', '社区谱面', '排位系统', '多种模式'], viralityMechanics: ['谱面分享', '成绩分享', '直播'], estimatedMonthlyRevenue: '$500K+', keywords: ['osu', '音游', '节奏'] },
  { name: 'Guitar Hero', category: 'rhythm', revenueModel: '付费下载 + DLC', keyFeatures: ['吉他控制器', '摇滚曲目', '乐队模式', '明星力'], viralityMechanics: ['高分分享', '多人对战'], estimatedMonthlyRevenue: 'N/A (经典)', keywords: ['guitar hero', '吉他英雄', '摇滚'] },

  // Tools / Productivity (non-game)
  { name: 'Notion', category: 'tool', revenueModel: 'Freemium 订阅', keyFeatures: ['笔记+数据库', '协作', '模板', 'API'], viralityMechanics: ['模板分享', '协作邀请', '公开页面'], estimatedMonthlyRevenue: '$30M+', keywords: ['notion', '笔记', '工具'] },
  { name: 'Figma', category: 'tool', revenueModel: 'Freemium 订阅', keyFeatures: ['协作设计', '实时编辑', '组件系统', '原型'], viralityMechanics: ['协作邀请', '设计稿分享', '社区资源'], estimatedMonthlyRevenue: '$50M+', keywords: ['figma', '设计', '协作'] },
  { name: 'Discord', category: 'bot', revenueModel: 'Nitro 订阅', keyFeatures: ['语音聊天', '服务器', 'Bot 生态', '直播'], viralityMechanics: ['服务器邀请', 'Bot 推荐', '社区口碑'], estimatedMonthlyRevenue: '$20M+', keywords: ['discord', '社区', '语音'] },

  // WeChat / Mini-program specific
  { name: '羊了个羊', category: 'puzzle', revenueModel: '广告（微信激励视频）', keyFeatures: ['三消堆叠', '极难第二关', '省份排名', '每日挑战'], viralityMechanics: ['省份排名攀比', '好友求助', '分享到群', '病毒式难度'], estimatedMonthlyRevenue: '¥1000万+ (peak)', keywords: ['羊了个羊', '微信小游戏', '三消', '堆叠'] },
  { name: '合成大西瓜', category: 'puzzle', revenueModel: '广告', keyFeatures: ['物理合成', '水果掉落', '简单上手', '随机性'], viralityMechanics: ['分数截图', '好友挑战'], estimatedMonthlyRevenue: '¥500万+ (peak)', keywords: ['合成大西瓜', '合成', '水果'] },
  { name: '跳一跳', category: 'arcade', revenueModel: '广告（品牌植入）', keyFeatures: ['按压跳跃', '盒子得分', '连续加分', '好友排名'], viralityMechanics: ['好友排名竞争', '分数分享', '群排行'], estimatedMonthlyRevenue: '¥100万/月', keywords: ['跳一跳', '微信', '跳跃'] },

  // Douyin / TikTok specific
  { name: '抖音小游戏合集', category: 'casual', revenueModel: '穿山甲广告', keyFeatures: ['超休闲', '即点即玩', '短视频引流', '录屏分享'], viralityMechanics: ['录屏分享回抖音', '挑战话题', '达人推荐'], estimatedMonthlyRevenue: ' varies', keywords: ['抖音小游戏', '超休闲', 'casual'] },
];

/* ──────────────────────────────────────────────
   Competitor Lookup
   ────────────────────────────────────────────── */

function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s\-_.]+/g, '');
}

function keywordOverlap(ideaText: string, keywords: string[]): number {
  const lower = normalize(ideaText);
  let score = 0;
  for (const kw of keywords) {
    const n = normalize(kw);
    if (lower.includes(n)) {
      score += n.length >= 4 ? 3 : n.length >= 2 ? 2 : 1;
    }
  }
  return score;
}

/**
 * Find the most relevant competitors from the mock database.
 * Returns up to 5 matches sorted by relevance.
 */
export function findCompetitors(ideaText: string): CompetitorProfile[] {
  const scored = MOCK_COMPETITORS.map((c) => ({
    profile: c,
    score: keywordOverlap(ideaText, c.keywords),
  }));

  scored.sort((a, b) => b.score - a.score);

  // Return top matches with non-zero score, or at least 1 if all zero
  const withScore = scored.filter((s) => s.score > 0);
  const results = withScore.length > 0 ? withScore.slice(0, 5) : scored.slice(0, 3);
  return results.map((r) => r.profile);
}

/**
 * Infer the game/product category from the idea text.
 */
export function inferCategory(ideaText: string): string {
  const lower = ideaText.toLowerCase();
  const categoryMap: Record<string, string[]> = {
    'match-3': ['消消乐', 'match-3', 'match3', '消除', '三消', 'candy'],
    'tower-defense': ['塔防', 'tower defense', 'td', '防御塔'],
    'endless-runner': ['跑酷', 'runner', 'endless', '跑'],
    'platformer': ['平台', 'platformer', '跳跃', 'jump'],
    'puzzle': ['puzzle', '益智', '解谜', '谜题', '数独', '2048', 'wordle'],
    'shooter': ['射击', 'shooter', 'fps', '枪', '狙击'],
    'racing': ['赛车', 'racing', '竞速', '赛车'],
    'card': ['卡牌', 'card', '扑克', '斗地主', '麻将'],
    'rpg': ['rpg', '角色扮演', '养成', '冒险'],
    'strategy': ['策略', 'strategy', 'slg', '战棋'],
    'arcade': ['街机', 'arcade', '休闲', 'casual', '贪吃蛇', '打砖块'],
    'rhythm': ['音游', 'rhythm', '音乐', '节奏', '钢琴'],
    'sandbox': ['沙盒', 'sandbox', '建造', '我的世界'],
    'simulation': ['模拟', 'simulation', '经营', '农场'],
    'social': ['社交', 'social', '狼人杀', '推理'],
    'tool': ['工具', 'tool', '助手', '计算器', 'calculator', '翻译', '词典', '日历', '提醒', '待办', '笔记', '浏览器', '编辑器', '播放器', '下载器', '转换器', 'formatter', 'parser', 'scraper', 'ai assistant'],
    'bot': ['机器人', 'bot', 'discord', 'telegram'],
  };

  for (const [cat, keywords] of Object.entries(categoryMap)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return cat;
    }
  }

  return 'generic';
}

/* ──────────────────────────────────────────────
   Monetization Strategy Design
   ────────────────────────────────────────────── */

const MONETIZATION_TEMPLATES: Record<string, Partial<MonetizationStrategy>> = {
  'wechat-miniprogram': {
    primary: '微信广告（激励视频 + 插屏广告 + Banner）',
    secondary: ['内购（游戏币/道具）', '订阅（去广告/Premium）'],
    adPlacements: ['结算页底部 Banner', '复活按钮激励视频', '关卡切换插屏广告', '每日奖励激励视频'],
    iapItems: ['去广告会员', '金币礼包', '体力补充', '皮肤/主题'],
    estimatedArpu: '¥0.3-1.0/日活用户',
    estimatedLtv: '¥5-20/用户',
  },
  'douyin': {
    primary: '穿山甲广告（激励视频 + 全屏视频 + Banner）',
    secondary: ['内购（游戏币）', '达人分成'],
    adPlacements: ['开屏全屏视频', '双倍金币激励视频', '底部 Banner', '关卡结束插屏'],
    iapItems: ['去广告', '金币', '道具包'],
    estimatedArpu: '¥0.5-2.0/日活用户',
    estimatedLtv: '¥10-30/用户',
  },
  'web': {
    primary: 'Google AdSense / 百度联盟（Banner + 插页）',
    secondary: ['Patreon / Ko-fi 订阅', '付费去广告', '数字商品'],
    adPlacements: ['页面底部 Banner', '游戏结束插页', '每3关激励视频（自建）'],
    iapItems: ['Premium 会员', '去广告', '主题包'],
    estimatedArpu: '$0.01-0.05/日活用户',
    estimatedLtv: '$1-5/用户',
  },
  'app-store': {
    primary: 'IAP（游戏币 + 去广告 + 订阅）',
    secondary: ['Apple Search Ads', 'App 内广告（AdMob）'],
    adPlacements: ['Banner（可选）', '激励视频（可选）'],
    iapItems: ['去广告终身版', '月度订阅', '金币礼包', '赛季通行证'],
    estimatedArpu: '$0.5-3.0/日活用户',
    estimatedLtv: '$20-80/用户',
  },
  'google-play': {
    primary: 'IAP + AdMob（激励视频 + Banner + 插屏）',
    secondary: ['Google Play Pass', '订阅'],
    adPlacements: ['底部 Banner', '复活激励视频', '关卡插屏'],
    iapItems: ['去广告', '金币', '通行证', '角色包'],
    estimatedArpu: '$0.3-2.0/日活用户',
    estimatedLtv: '$15-60/用户',
  },
  'steam': {
    primary: '付费下载',
    secondary: ['DLC', '季票', '内购（可选）'],
    adPlacements: [],
    iapItems: ['DLC 扩展包', '外观皮肤', '季票'],
    estimatedArpu: '$5-15/购买者',
    estimatedLtv: '$20-50/用户',
  },
  'itchio': {
    primary: 'Pay What You Want / 固定价格',
    secondary: ['DLC', '捐赠'],
    adPlacements: [],
    iapItems: ['扩展包', '原声带', '美术集'],
    estimatedArpu: '$3-8/购买者',
    estimatedLtv: '$10-25/用户',
  },
  'discord-bot': {
    primary: 'Premium 功能订阅',
    secondary: ['捐赠', '服务器 Boost 分成'],
    adPlacements: [],
    iapItems: ['Premium 订阅（月/年）', '高级功能解锁'],
    estimatedArpu: '$2-5/付费用户/月',
    estimatedLtv: '$30-100/用户',
  },
  'telegram-bot': {
    primary: '广告（Telegram Ads）+ Premium 功能',
    secondary: ['TON 支付', '捐赠'],
    adPlacements: ['Bot 内广告'],
    iapItems: ['Premium 功能', '积分包'],
    estimatedArpu: '$0.5-2.0/活跃用户/月',
    estimatedLtv: '$10-40/用户',
  },
  'github-sponsors': {
    primary: '月度赞助',
    secondary: ['一次性捐赠', '企业授权'],
    adPlacements: [],
    iapItems: ['赞助等级', '企业授权'],
    estimatedArpu: '$5-25/赞助者/月',
    estimatedLtv: '$100-500/赞助者',
  },
  'unknown': {
    primary: '广告 + IAP',
    secondary: ['订阅', '捐赠'],
    adPlacements: ['Banner', '激励视频', '插屏'],
    iapItems: ['去广告', '游戏币', '皮肤'],
    estimatedArpu: '视平台而定',
    estimatedLtv: '视平台而定',
  },
};

const GAME_TYPE_MONETIZATION_BOOST: Record<string, Partial<MonetizationStrategy>> = {
  'match-3': { secondary: ['生命购买', '道具包', '关卡解锁'], iapItems: ['额外生命', '彩虹炸弹', '锤子道具', '无限体力'] },
  'tower-defense': { secondary: ['英雄解锁', '皮肤', '加速'], iapItems: ['新英雄', '塔皮肤', '双倍金币', '跳过波次'] },
  'endless-runner': { secondary: ['角色解锁', '滑板/载具', '磁铁道具'], iapItems: ['角色', '滑板', '开局加速', '复活'] },
  'platformer': { secondary: ['章节解锁', '皮肤', ' checkpoint'], iapItems: ['新章节', '角色皮肤', '生命包'] },
  'puzzle': { secondary: ['提示购买', '关卡包', '去广告'], iapItems: ['提示', '答案', '关卡包', '主题'] },
  'card': { secondary: ['卡包', '竞技场门票', '皮肤'], iapItems: ['卡包', '竞技场券', '卡背', '英雄皮肤'] },
  'rpg': { secondary: ['抽卡', '体力', '装备'], iapItems: ['召唤券', '体力药水', '装备箱', '月卡'] },
  'shooter': { secondary: ['武器皮肤', '角色', 'Battle Pass'], iapItems: ['武器箱', '角色', '通行证', '经验加成'] },
  'racing': { secondary: ['车辆解锁', '改装', '涂装'], iapItems: ['新车', '改装件', '涂装', '氮气包'] },
  'rhythm': { secondary: ['曲包', '皮肤', 'note 样式'], iapItems: ['曲包', '皮肤', '判定线样式'] },
  'arcade': { secondary: ['皮肤', '道具', '去广告'], iapItems: ['角色皮肤', '道具包', '复活'] },
  'strategy': { secondary: ['资源包', '加速', '英雄'], iapItems: ['宝石', '加速券', '英雄碎片'] },
  'simulation': { secondary: ['装饰品', '扩展包', '加速'], iapItems: ['家具包', '扩展地图', '货币包'] },
  'sandbox': { secondary: ['皮肤', '材质包', 'Realms 订阅'], iapItems: ['皮肤', '材质包', '地图', 'Realms'] },
};

/**
 * Design a monetization strategy matched to the platform and game type.
 */
export function designMonetization(
  _ideaText: string,
  gameType: string = 'generic',
  monetization: string = 'unknown',
): MonetizationStrategy {
  const platformKey = monetization in MONETIZATION_TEMPLATES ? monetization : 'unknown';
  const base = MONETIZATION_TEMPLATES[platformKey] || MONETIZATION_TEMPLATES['unknown'];
  const boost = GAME_TYPE_MONETIZATION_BOOST[gameType] || {};

  // Merge IAP items
  const mergedIap = [...(base.iapItems || []), ...(boost.iapItems || [])].slice(0, 6);
  const mergedSecondary = [...new Set([...(base.secondary || []), ...(boost.secondary || [])])].slice(0, 4);

  // Platform fit score
  let platformFit = 70;
  if (['web', 'itchio', 'github-sponsors'].includes(platformKey)) platformFit = 60;
  if (['wechat-miniprogram', 'douyin'].includes(platformKey)) platformFit = 85;
  if (['app-store', 'google-play'].includes(platformKey)) platformFit = 90;
  if (platformKey === 'unknown') platformFit = 50;

  return {
    primary: base.primary || '广告 + IAP',
    secondary: mergedSecondary,
    adPlacements: base.adPlacements || [],
    iapItems: mergedIap,
    estimatedArpu: base.estimatedArpu || '视平台而定',
    estimatedLtv: base.estimatedLtv || '视平台而定',
    platformFit,
  };
}

/* ──────────────────────────────────────────────
   Virality Design
   ────────────────────────────────────────────── */

const VIRALITY_TEMPLATES: Record<string, Partial<ViralityDesign>> = {
  'match-3': {
    shareTriggers: ['通关高分', '获得三星', '通过极难关卡', '好友求助'],
    referralRewards: ['送生命', '送道具', '双方得金币'],
    socialProofMechanics: ['好友排行榜', '全球排行', '关卡进度地图'],
    estimatedKFactor: 0.3,
  },
  'tower-defense': {
    shareTriggers: ['通关高难度关卡', '解锁新英雄', '达成无伤', '速通记录'],
    referralRewards: ['双方得宝石', '解锁合作模式'],
    socialProofMechanics: ['排行榜', '成就徽章', '段位系统'],
    estimatedKFactor: 0.15,
  },
  'endless-runner': {
    shareTriggers: ['打破个人记录', '超越好友', '解锁新角色', '搞笑死亡'],
    referralRewards: ['双方得金币', '解锁限定角色'],
    socialProofMechanics: ['距离排行榜', '角色收集展示', '每日挑战'],
    estimatedKFactor: 0.25,
  },
  'platformer': {
    shareTriggers: ['通关隐藏关', '速通成就', '收集全道具', '发现彩蛋'],
    referralRewards: ['解锁合作模式', '双方得皮肤'],
    socialProofMechanics: ['速通排行榜', '成就系统', '死亡计数展示'],
    estimatedKFactor: 0.12,
  },
  'puzzle': {
    shareTriggers: ['每日挑战完成', '连胜记录', '极难谜题破解'],
    referralRewards: ['双方得提示', '解锁谜题包'],
    socialProofMechanics: ['连胜榜', '解谜时间榜', '段位'],
    estimatedKFactor: 0.2,
  },
  'card': {
    shareTriggers: ['抽到稀有卡', '卡组胜利', '竞技场高胜'],
    referralRewards: ['双方得卡包', '解锁对战模式'],
    socialProofMechanics: ['段位榜', '卡组展示', '胜率统计'],
    estimatedKFactor: 0.18,
  },
  'rpg': {
    shareTriggers: ['抽到SSR', '通关Boss', '装备强化+15', '公会战胜利'],
    referralRewards: ['双方得召唤券', '邀请码奖励'],
    socialProofMechanics: ['战力排行榜', '公会榜', '装备展示'],
    estimatedKFactor: 0.22,
  },
  'shooter': {
    shareTriggers: ['吃鸡胜利', '精彩击杀', '排位晋级', '获得传说皮肤'],
    referralRewards: ['双方得箱子', '组队经验加成'],
    socialProofMechanics: ['KD榜', '段位榜', '皮肤展示'],
    estimatedKFactor: 0.25,
  },
  'racing': {
    shareTriggers: ['打破赛道记录', '解锁新车', '漂移高分', '联赛晋级'],
    referralRewards: ['双方得金币', '解锁限定车'],
    socialProofMechanics: ['赛道记录榜', '车辆收藏', '联赛排名'],
    estimatedKFactor: 0.15,
  },
  'rhythm': {
    shareTriggers: ['FC/AP 成就', '打破个人记录', '通关极难谱面'],
    referralRewards: ['双方得曲包', '解锁合作模式'],
    socialProofMechanics: ['准度排行榜', '成就墙', '谱面评价'],
    estimatedKFactor: 0.1,
  },
  'arcade': {
    shareTriggers: ['高分截图', '搞笑时刻', '解锁成就'],
    referralRewards: ['双方得金币', '解锁角色'],
    socialProofMechanics: ['分数榜', '成就系统'],
    estimatedKFactor: 0.2,
  },
  'strategy': {
    shareTriggers: ['联盟战胜利', '攻城成功', '排名晋升'],
    referralRewards: ['双方得资源', '联盟邀请奖励'],
    socialProofMechanics: ['战力榜', '联盟榜', '赛季排名'],
    estimatedKFactor: 0.15,
  },
  'simulation': {
    shareTriggers: ['农场/城镇截图', '达成目标', '解锁建筑'],
    referralRewards: ['双方得货币', '访问好友农场'],
    socialProofMechanics: ['好友互访', '成就展示'],
    estimatedKFactor: 0.12,
  },
  'sandbox': {
    shareTriggers: ['建造作品', '模组发布', '通关地图'],
    referralRewards: ['双方得皮肤', 'Realm 邀请'],
    socialProofMechanics: ['作品展示', '下载榜', '创作者排行'],
    estimatedKFactor: 0.3,
  },
  'social': {
    shareTriggers: ['搞笑时刻', '精彩推理', '好友对战'],
    referralRewards: ['双方得货币', '解锁模式'],
    socialProofMechanics: ['胜率榜', '好友列表', '房间邀请'],
    estimatedKFactor: 0.35,
  },
  'tool': {
    shareTriggers: ['使用成果', '模板分享', '效率提升'],
    referralRewards: ['双方得积分', '高级功能试用'],
    socialProofMechanics: ['使用统计', '模板市场'],
    estimatedKFactor: 0.08,
  },
  'bot': {
    shareTriggers: ['Bot 有趣回复', '功能展示', '服务器成果'],
    referralRewards: ['双方得 Premium', '邀请返利'],
    socialProofMechanics: ['服务器数量', '用户评分', '功能列表'],
    estimatedKFactor: 0.1,
  },
  'generic': {
    shareTriggers: ['成就解锁', '进度里程碑', '高分记录'],
    referralRewards: ['双方得奖励'],
    socialProofMechanics: ['排行榜', '成就'],
    estimatedKFactor: 0.15,
  },
};

/**
 * Design viral mechanics for the product.
 */
export function designVirality(ideaText: string, gameType: string = 'generic'): ViralityDesign {
  const tmpl = VIRALITY_TEMPLATES[gameType] || VIRALITY_TEMPLATES['generic'];

  // Adjust K-factor based on platform hints in ideaText
  let kFactor = tmpl.estimatedKFactor || 0.15;
  const lower = ideaText.toLowerCase();
  if (lower.includes('微信') || lower.includes('wechat')) kFactor += 0.1;
  if (lower.includes('抖音') || lower.includes('douyin') || lower.includes('tiktok')) kFactor += 0.15;
  if (lower.includes('社交') || lower.includes('social') || lower.includes(' multiplayer')) kFactor += 0.1;
  if (lower.includes('分享') || lower.includes('share')) kFactor += 0.08;
  kFactor = Math.min(1.0, Math.round(kFactor * 100) / 100);

  const loopDesc =
    kFactor >= 0.3
      ? '强病毒循环：每个用户平均带来 0.3+ 新用户，适合裂变增长。重点设计分享激励和社交攀比机制。'
      : kFactor >= 0.2
        ? '中等病毒循环：有一定传播潜力，可通过优化分享触发点和奖励提升系数。'
        : '弱病毒循环：产品本身传播性有限，建议依赖内容营销（短视频、直播）或付费买量获取用户。';

  return {
    shareTriggers: tmpl.shareTriggers || ['成就解锁', '高分记录'],
    referralRewards: tmpl.referralRewards || ['双方得奖励'],
    socialProofMechanics: tmpl.socialProofMechanics || ['排行榜', '成就'],
    viralLoopDescription: loopDesc,
    estimatedKFactor: kFactor,
  };
}

/* ──────────────────────────────────────────────
   Differentiation USP Generator
   ────────────────────────────────────────────── */

function generateUsp(ideaText: string, _competitors: CompetitorProfile[], category: string): string {
  const lower = ideaText.toLowerCase();

  // Extract unique keywords from the idea that aren't in competitors
  const uniqueHints: string[] = [];
  if (lower.includes('像素') || lower.includes('pixel')) uniqueHints.push('复古像素美学');
  if (lower.includes(' Roguelike') || lower.includes('roguelike')) uniqueHints.push('Roguelike 随机性');
  if (lower.includes('肉鸽')) uniqueHints.push('Roguelike 随机性');
  if (lower.includes('多人') || lower.includes('multiplayer') || lower.includes('pvp')) uniqueHints.push('实时多人对战');
  if (lower.includes('物理') || lower.includes('physics')) uniqueHints.push('真实物理引擎');
  if (lower.includes('剧情') || lower.includes('story')) uniqueHints.push('深度剧情叙事');
  if (lower.includes('ai') || lower.includes('人工智能')) uniqueHints.push('AI 驱动玩法');
  if (lower.includes('ar') || lower.includes('增强现实')) uniqueHints.push('AR 增强现实');
  if (lower.includes('vr')) uniqueHints.push('VR 沉浸式体验');
  if (lower.includes('区块链') || lower.includes('nft') || lower.includes('web3')) uniqueHints.push('Web3 经济系统');
  if (lower.includes('元宇宙') || lower.includes('metaverse')) uniqueHints.push('元宇宙社交');
  if (lower.includes('创意') || lower.includes('creator') || lower.includes('ugc')) uniqueHints.push('用户创作内容');
  if (lower.includes('教育') || lower.includes('学习') || lower.includes('edu')) uniqueHints.push('寓教于乐设计');
  if (lower.includes('健身') || lower.includes('运动') || lower.includes('health')) uniqueHints.push('健康运动结合');
  if (lower.includes('禅') || lower.includes('zen') || lower.includes('放松')) uniqueHints.push('禅意放松体验');

  if (uniqueHints.length === 0) {
    // Fallback USP based on category
    const fallbackUsp: Record<string, string> = {
      'match-3': '创新消除机制 + 装饰/叙事包装，区别于传统纯消除',
      'tower-defense': '英雄主动操控 + 塔防结合，增加操作深度',
      'endless-runner': '随机生成关卡 + 角色技能组合，每次游玩体验不同',
      'platformer': '精巧关卡设计 + 速通支持，目标硬核玩家社区',
      'puzzle': '每日挑战 + 社区谜题分享，持续内容更新',
      'card': '快节奏对战 + 独特机制，单局 3-5 分钟',
      'rpg': '轻量化养成 + 碎片化玩法，适合移动端',
      'shooter': '独特武器系统 + 地形破坏，增加战术深度',
      'racing': '物理漂移 + 车辆改装深度，硬核驾驶体验',
      'rhythm': '自定义谱面 + 社区曲库，无限内容扩展',
      'arcade': '极简操作 + 高难度挑战，适合短视频传播',
      'strategy': '异步对战 + 联盟协作，降低实时压力',
      'simulation': '高自由度 + 社交互动，创造独特故事',
      'sandbox': '低门槛创作 + 一键分享，降低 UGC 门槛',
      'social': '语音社交 + 角色扮演，增强沉浸感',
      'tool': 'AI 增强 + 自动化工作流，提升 10 倍效率',
      'bot': '多平台集成 + 可视化配置，零代码部署',
    };
    return fallbackUsp[category] || '专注核心体验优化，在细分品类中做到最佳';
  }

  return uniqueHints.join(' + ') + '，在同品类中形成差异化记忆点';
}

/* ──────────────────────────────────────────────
   Success Rate Estimation
   ────────────────────────────────────────────── */

function estimateSuccessRate(
  competitors: CompetitorProfile[],
  monetization: MonetizationStrategy,
  virality: ViralityDesign,
  category: string,
): number {
  // Base score
  let score = 50;

  // Competition density penalty (more big competitors = harder)
  const bigCompetitors = competitors.filter(
    (c) => c.estimatedMonthlyRevenue.includes('M') || c.estimatedMonthlyRevenue.includes('千万'),
  ).length;
  score -= bigCompetitors * 5;

  // Monetization fit bonus
  score += monetization.platformFit * 0.2;

  // Virality bonus
  score += virality.estimatedKFactor * 30;

  // Category-specific adjustments
  const categoryBonus: Record<string, number> = {
    'arcade': 10,
    'puzzle': 8,
    'match-3': 5,
    'endless-runner': 5,
    'social': 12,
    'sandbox': 8,
    'tool': 10,
    'bot': 5,
    'rpg': -5,
    'strategy': -5,
    'shooter': -8,
  };
  score += categoryBonus[category] || 0;

  return Math.max(10, Math.min(95, Math.round(score)));
}

/* ──────────────────────────────────────────────
   Actionable Recommendations
   ────────────────────────────────────────────── */

function generateRecommendations(
  competitors: CompetitorProfile[],
  monetization: MonetizationStrategy,
  virality: ViralityDesign,
  category: string,
): string[] {
  const recs: string[] = [];

  // Competitor-based recs
  if (competitors.length > 0) {
    const top = competitors[0];
    recs.push(`对标 ${top.name} 的核心机制，但简化上手门槛，首关 30 秒内必须让用户理解玩法`);
  }

  // Monetization recs
  if (monetization.adPlacements.length > 0) {
    recs.push(`广告位设计：${monetization.adPlacements[0]}，确保不影响核心玩法体验`);
  }
  if (monetization.iapItems.length > 0) {
    recs.push(`首充设计：将 "${monetization.iapItems[0]}" 定价 ¥1-6，大幅降低首次付费门槛`);
  }

  // Virality recs
  if (virality.estimatedKFactor >= 0.25) {
    recs.push('病毒传播：设计“分享得奖励”闭环，分享后双方获益，K 因子目标 ≥ 0.3');
  } else {
    recs.push('获客策略：产品本身传播性有限，建议搭配短视频内容营销（抖音/B站）引流');
  }

  // Category-specific recs
  const categoryRecs: Record<string, string> = {
    'match-3': '关卡设计：前 10 关通过率 95%+，第 20 关引入首个付费点（生命/道具）',
    'tower-defense': '难度曲线：前 3 关教学，第 5 关引入英雄系统，第 10 关需要策略升级',
    'endless-runner': '留存设计：每日任务 + 角色收集，7 日留存目标 25%+',
    'platformer': '社区运营：支持速通计时 + 排行榜，吸引核心玩家传播',
    'puzzle': '内容更新：每日一题 + 社区投稿，保持长期活跃度',
    'card': '经济平衡：免费玩家可通过时间积累，付费玩家获得便利而非碾压优势',
    'rpg': '轻量化：单局 5-10 分钟，支持离线收益，降低流失',
    'shooter': '操作优化：移动端自动瞄准 + 自定义灵敏度，降低操作门槛',
    'racing': '物理反馈：漂移手感是核心差异化，投入 30% 开发时间打磨',
    'rhythm': '曲库策略：首发 20+ 首免费曲，每周更新 1 首，维持新鲜感',
    'arcade': '病毒设计：设计“搞笑失败”时刻，天然适合录屏分享',
    'strategy': '异步设计：支持离线防守 + 异步攻击，避免实时匹配等待',
    'simulation': '社交设计：好友互访 + 互助系统，增加打开频率',
    'sandbox': 'UGC 门槛：提供模板 + 一键发布，降低创作门槛至 5 分钟',
    'social': '语音优先：集成实时语音，提升社交粘性',
    'tool': '集成策略：对接主流平台 API，成为工作流必需环节',
    'bot': '多平台：一次开发，Discord + Telegram + 飞书同时部署',
  };
  if (categoryRecs[category]) {
    recs.push(categoryRecs[category]);
  }

  // PWA / platform recs
  recs.push('PWA 支持：生成 manifest.json + sw.js，让用户可添加到主屏幕，提升留存 20%+');

  return recs.slice(0, 6);
}

/* ──────────────────────────────────────────────
   Main Report Generation
   ────────────────────────────────────────────── */

/**
 * Generate a complete Product Partner report.
 */
export function generateProductPartnerReport(
  ideaText: string,
  gameType?: string,
  monetization?: string,
): ProductPartnerReport {
  const detectedType = gameType || inferCategory(ideaText);
  const competitors = findCompetitors(ideaText);
  const monStrategy = designMonetization(ideaText, detectedType, monetization);
  const viral = designVirality(ideaText, detectedType);
  const usp = generateUsp(ideaText, competitors, detectedType);
  const successRate = estimateSuccessRate(competitors, monStrategy, viral, detectedType);
  const recommendations = generateRecommendations(competitors, monStrategy, viral, detectedType);

  return {
    competitorAnalysis: competitors,
    monetizationStrategy: monStrategy,
    viralityDesign: viral,
    differentiationUsp: usp,
    estimatedSuccessRate: successRate,
    actionableRecommendations: recommendations,
  };
}

/**
 * Format the Product Partner report for terminal display.
 */
export function formatProductPartnerReport(report: ProductPartnerReport): string {
  let out = '\n📊 产品经理报告\n';
  out += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

  // Competitor Analysis
  out += '\n🎯 竞品分析\n';
  if (report.competitorAnalysis.length > 0) {
    for (const c of report.competitorAnalysis) {
      out += `   • ${c.name}（${c.category}）— ${c.revenueModel}\n`;
      out += `     核心功能: ${c.keyFeatures.slice(0, 3).join('、')}\n`;
      out += `     传播机制: ${c.viralityMechanics.slice(0, 2).join('、')}\n`;
    }
  } else {
    out += '   • 未找到直接竞品，属于蓝海领域\n';
  }

  // Monetization Strategy
  out += '\n💰 变现策略设计\n';
  out += `   主要模式: ${report.monetizationStrategy.primary}\n`;
  if (report.monetizationStrategy.secondary.length > 0) {
    out += `   辅助模式: ${report.monetizationStrategy.secondary.join('、')}\n`;
  }
  if (report.monetizationStrategy.adPlacements.length > 0) {
    out += `   广告位: ${report.monetizationStrategy.adPlacements.join('、')}\n`;
  }
  if (report.monetizationStrategy.iapItems.length > 0) {
    out += `   内购项: ${report.monetizationStrategy.iapItems.slice(0, 4).join('、')}\n`;
  }
  out += `   ARPU 预估: ${report.monetizationStrategy.estimatedArpu}\n`;
  out += `   LTV 预估: ${report.monetizationStrategy.estimatedLtv}\n`;
  out += `   平台匹配度: ${report.monetizationStrategy.platformFit}/100\n`;

  // Virality Design
  out += '\n🦠 病毒传播机制\n';
  out += `   分享触发: ${report.viralityDesign.shareTriggers.slice(0, 3).join('、')}\n`;
  out += `   邀请奖励: ${report.viralityDesign.referralRewards.slice(0, 2).join('、')}\n`;
  out += `   社交证明: ${report.viralityDesign.socialProofMechanics.slice(0, 3).join('、')}\n`;
  out += `   预估 K 因子: ${report.viralityDesign.estimatedKFactor}\n`;
  out += `   ${report.viralityDesign.viralLoopDescription}\n`;

  // Differentiation USP
  out += '\n⭐ 差异化卖点（USP）\n';
  out += `   ${report.differentiationUsp}\n`;

  // Success Rate
  const rateEmoji = report.estimatedSuccessRate >= 70 ? '🟢' : report.estimatedSuccessRate >= 45 ? '🟡' : '🔴';
  out += `\n📈 预估成功率: ${rateEmoji} ${report.estimatedSuccessRate}%\n`;

  // Recommendations
  out += '\n💡 行动建议\n';
  for (const rec of report.actionableRecommendations) {
    out += `   • ${rec}\n`;
  }

  out += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  return out;
}

/**
 * Export the mock competitor database for testing and research engine use.
 */
export { MOCK_COMPETITORS };
