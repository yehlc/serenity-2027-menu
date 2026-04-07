const express = require('express');
const { LineBotClient, validateSignature } = require('@line/bot-sdk');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();

// LINE Bot SDK config - credentials needed for LINE features
let lineClient = null;
const lineConfig = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

if (lineConfig.channelAccessToken && lineConfig.channelSecret) {
  lineClient = new LineBotClient(lineConfig);
}

// Express config
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============ 年菜菜單資料 ============
const MENU_DATA = {
  combos: [
    {
      id: 'combo-furui',
      name: '福瑞套餐',
      price: 3680,
      serving: '6人份',
      description: '經典大千留住你的胃',
      items: ['紅燒獅子頭', '干鍋花椰菜', '酸白菜火鍋', '豆酥排骨酥', '雪菜豆包'],
      image: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=600&h=400&fit=crop'
    },
    {
      id: 'combo-jixiang',
      name: '吉祥套餐',
      price: 4680,
      serving: '8人份',
      description: '豐盛滿漢團圓桌',
      items: ['紅燒獅子頭', '干鍋花椰菜', '酸白菜火鍋', '豆酥排骨酥', '雪菜豆包', '雪菜豆'],
      image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&h=400&fit=crop'
    }
  ],
  hotDishes: [
    { id: 'd1', name: '五福玉臨門', subtitle: '祥和拼盤', price: 800, type: '奶蛋素', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop' },
    { id: 'd2', name: '御品佛跳牆', subtitle: '佛跳牆', price: 1380, type: '全素', image: 'https://images.unsplash.com/photo-1540189544446-9760fd1d4b44?w=400&h=300&fit=crop' },
    { id: 'd3', name: '鳳凰舞九天', subtitle: '蓉城口水雞', price: 760, type: '奶蛋素', image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop' },
    { id: 'd4', name: '金雞鳴呈祥', subtitle: '祥和素油雞', price: 640, type: '奶蛋素', image: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c3?w=400&h=300&fit=crop' },
    { id: 'd5', name: '吉祥如意鍋', subtitle: '酸白菜鍋', price: 860, type: '奶蛋素', image: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=400&h=300&fit=crop' },
    { id: 'd6', name: '富貴滿門鍋', subtitle: '麻油鍋', price: 860, type: '奶蛋素', image: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=400&h=300&fit=crop' },
    { id: 'd7', name: '金玉滿堂鍋', subtitle: '南洋肉骨茶鍋', price: 1380, type: '全素', image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&h=300&fit=crop' },
    { id: 'd8', name: '富貴耀滿門', subtitle: '麻油素腰花', price: 760, type: '全素', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop' },
    { id: 'd9', name: '天香蒸白玉', subtitle: '清蒸臭豆腐', price: 640, type: '全素', image: 'https://images.unsplash.com/photo-1540189544446-9760fd1d4b44?w=400&h=300&fit=crop' },
    { id: 'd10', name: '麻辣燒白玉', subtitle: '麻辣臭豆腐', price: 600, type: '全素', image: 'https://images.unsplash.com/photo-1540189544446-9760fd1d4b44?w=400&h=300&fit=crop' },
    { id: 'd11', name: '金獅獻祥瑞', subtitle: '紅燒獅子頭', price: 640, type: '奶蛋素', image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop' },
    { id: 'd12', name: '水濂猴王菇', subtitle: '三杯猴頭菇', price: 760, type: '全素', image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop' },
    { id: 'd13', name: '蜜桃糖醋肉', subtitle: '糖醋素雞丁', price: 600, type: '奶蛋素', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop' },
    { id: 'd14', name: '金牛運百寶', subtitle: '酸白菜素牛肉', price: 560, type: '奶蛋素', image: 'https://images.unsplash.com/photo-1540189544446-9760fd1d4b44?w=400&h=300&fit=crop' },
    { id: 'd15', name: '宮保鳳于飛', subtitle: '宮保素雞丁', price: 600, type: '奶蛋素', image: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=400&h=300&fit=crop' },
    { id: 'd16', name: '乾坤好彩頭', subtitle: '素香鮑菇牛腩煲', price: 720, type: '全素', image: 'https://images.unsplash.com/photo-1540189544446-9760fd1d4b44?w=400&h=300&fit=crop' }
  ],
  frozenDishes: [
    { id: 'f1', name: '冷凍椒麻油飯', price: 300, type: '奶蛋素', image: 'https://images.unsplash.com/photo-1596088065578-4c5bd0cc7d95?w=400&h=300&fit=crop' },
    { id: 'f2', name: '冷凍松露油飯', price: 380, type: '全素', image: 'https://images.unsplash.com/photo-1596088065578-4c5bd0cc7d95?w=400&h=300&fit=crop' },
    { id: 'f3', name: '冷凍炒炊粉', price: 180, type: '全素', image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&h=300&fit=crop' }
  ]
};

// ============ API: 取得菜單 ============
app.get('/api/menu', (req, res) => {
  res.json(MENU_DATA);
});

// ============ API: 建立訂單 ============
app.post('/api/orders', async (req, res) => {
  try {
    const { combo, sideDishes, customer, notes, totalAmount } = req.body;
    
    // 驗證必填欄位
    if (!customer.name || !customer.phone || !customer.store || !customer.pickupDate) {
      return res.status(400).json({ error: '請填寫完整顧客資料' });
    }

    const order = {
      id: 'ORD' + Date.now(),
      timestamp: new Date().toISOString(),
      combo,
      sideDishes,
      customer,
      notes,
      totalAmount,
      status: 'pending'
    };

    // 發送 Email 通知
    await sendOrderEmail(order);

    // 發送 LINE 通知（可選）
    // await sendLineNotification(order);

    console.log('新訂單:', JSON.stringify(order, null, 2));
    res.json({ success: true, orderId: order.id, order });
  } catch (error) {
    console.error('訂單錯誤:', error);
    res.status(500).json({ error: '訂單處理失敗，請稍後再試' });
  }
});

// ============ LINE Webhook ============
app.post('/webhook', (req, res) => {
  if (lineClient && lineConfig.channelSecret) {
    const sig = req.headers['x-line-signature'];
    const body = JSON.stringify(req.body);
    if (!validateSignature(body, lineConfig.channelSecret, sig)) {
      return res.status(403).send('Forbidden');
    }
  }
  
  if (!lineClient) {
    return res.status(500).send('LINE Bot not configured');
  }
  
  Promise
    .all(req.body.events.map(handleLineEvent))
    .then(() => res.end())
    .catch(err => {
      console.error(err);
      res.status(500).end();
    });
});

async function handleLineEvent(event) {
  if (!lineClient) return;
  if (event.type !== 'message' && event.type !== 'postback') return;
  
  const userMessage = event.message ? event.message.text : '';
  const userId = event.source.userId;

  // 回覆選單
  const replyText = `🧧 祥和蔬食 2027 年菜預購

感謝您的訊息！請選擇服務：

1️⃣ 【瀏覽年菜菜單】輸入「菜單」
2️⃣ 【開始預購】輸入「預購」
3️⃣ 【查看我的訂單】輸入「訂單」
4️⃣ 【聯絡我們】輸入「聯絡」

或直接點選下方按鈕 👇`;

  return lineClient.replyMessage(event.replyToken, {
    type: 'text',
    text: replyText
  });
}

// ============ Email 通知 ============
async function sendOrderEmail(order) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'skywing4890@gmail.com',
      pass: process.env.EMAIL_PASS || 'YOUR_APP_PASSWORD'
    }
  });

  const comboInfo = order.combo 
    ? `${order.combo.name} ($${order.combo.price})`
    : '未選套餐';

  const sideDishesInfo = order.sideDishes && order.sideDishes.length > 0
    ? order.sideDishes.map(s => `${s.name} x${s.qty} ($${s.price * s.qty})`).join('\n    ')
    : '無';

  const mailOptions = {
    from: '"祥和蔬食年菜系統" <skywing4890@gmail.com>',
    to: 'yehlc@tonsin.com.tw',
    cc: 'skywing4890@gmail.com',
    subject: `🧧 新年菜訂單！${order.customer.name} - ${order.id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <div style="background: linear-gradient(135deg, #c0392b, #e74c3c); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">🧧 祥和蔬食 - 新年菜訂單</h1>
          <p style="margin: 5px 0 0;">訂單編號: ${order.id}</p>
        </div>
        
        <div style="padding: 20px; background: #fff;">
          <h2 style="color: #c0392b; border-bottom: 2px solid #eee; padding-bottom: 10px;">📋 顧客資料</h2>
          <table style="width: 100%;">
            <tr><td style="padding: 8px; color: #888;">姓名</td><td style="padding: 8px; font-weight: bold;">${order.customer.name}</td></tr>
            <tr><td style="padding: 8px; color: #888;">電話</td><td style="padding: 8px;">${order.customer.phone}</td></tr>
            <tr><td style="padding: 8px; color: #888;">取貨分店</td><td style="padding: 8px;">${order.customer.store}</td></tr>
            <tr><td style="padding: 8px; color: #888;">取貨日期</td><td style="padding: 8px;">${order.customer.pickupDate}</td></tr>
          </table>

          <h2 style="color: #c0392b; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 20px;">🍽 套餐</h2>
          <p>${comboInfo}</p>

          <h2 style="color: #c0392b; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 20px;">🥢 單點</h2>
          <pre style="background: #f9f9f9; padding: 10px; border-radius: 5px;">${sideDishesInfo}</pre>

          <h2 style="color: #c0392b; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 20px;">💰 總金額</h2>
          <p style="font-size: 24px; color: #c0392b; font-weight: bold;">$${order.totalAmount}</p>

          ${order.notes ? `<h2 style="color: #c0392b; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 20px;">📝 備註</h2><p>${order.notes}</p>` : ''}
        </div>
        
        <div style="background: #2c3e50; color: white; padding: 15px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px;">
          祥和蔬食料理｜鎮江店：02-2357-0377｜慶城店：02-2546-6768
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email 通知已發送');
  } catch (error) {
    console.error('Email 發送失敗:', error);
  }
}

// ============ 健康檢查 ============
app.get('/health', (req, res) => {
  res.json({ status: 'ok', bot: 'serenity-2027', time: new Date().toISOString() });
});

// ============ 啟動伺服器 ============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`祥和蔬食 2027 年菜系統啟動！端口: ${PORT}`);
  console.log(`年菜 Menu: http://localhost:${PORT}/`);
});
