const express = require('express');
const line = require('@line/bot-sdk');
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
  try {
    lineClient = new line.Client(lineConfig);
    console.log('LINE Bot credentials loaded successfully');
    console.log('lineClient type:', typeof lineClient);
    console.log('lineClient.replyMessage type:', typeof lineClient.replyMessage);
  } catch (e) {
    console.error('LINE Client initialization error:', e);
  }
} else {
  console.log('WARNING: LINE Bot credentials not set - LINE features disabled');
}

// Express config
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
    if (!customer || !customer.name || !customer.phone || !customer.store || !customer.pickupDate) {
      return res.status(400).json({ error: '請填寫完整顧客資料（姓名、電話、取貨分店、取貨日期）' });
    }

    const order = {
      id: 'ORD' + Date.now(),
      timestamp: new Date().toISOString(),
      combo,
      sideDishes: sideDishes || [],
      customer,
      notes: notes || '',
      totalAmount: totalAmount || 0,
      status: 'pending',
      paymentStatus: 'unpaid'
    };

    console.log('===== 新訂單 =====');
    console.log('訂單編號:', order.id);
    console.log('顧客:', order.customer.name);
    console.log('電話:', order.customer.phone);
    console.log('分店:', order.customer.store);
    console.log('取貨日期:', order.customer.pickupDate);
    console.log('套餐:', combo ? combo.name : '未選');
    console.log('單點數量:', (sideDishes || []).length);
    console.log('總金額:', totalAmount);
    console.log('====================');

    // 發送 Email 通知（失敗不影響訂單成立）
    try {
      await sendOrderEmail(order);
    } catch (emailErr) {
      console.error('Email 發送失敗（訂單已成立）:', emailErr.message);
    }

    res.json({ 
      success: true, 
      orderId: order.id, 
      message: '訂單已送出！店家會儘快與您聯絡確認',
      order 
    });
  } catch (error) {
    console.error('訂單錯誤:', error);
    res.status(500).json({ error: '訂單處理失敗，請稍後再試，或直接致電店家：02-2357-0377' });
  }
});

// ============ LINE Webhook (GET for LINE verification) ============
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && (token === '' || token === null)) {
    res.send(challenge);
  } else {
    res.send('ERROR');
  }
});

// ============ LINE Webhook (POST for LINE events) ============
app.post('/webhook', line.middleware(lineConfig), (req, res) => {
  if (!lineClient) {
    return res.status(500).send('LINE Bot not configured');
  }
  
  Promise
    .all(req.body.events.map(handleLineEvent))
    .then(() => res.end())
    .catch(err => {
      console.error('Event handling error:', err);
      res.status(500).end();
    });
});

async function handleLineEvent(event) {
  if (!lineClient) {
    console.log('handleLineEvent: lineClient is null');
    return;
  }
  
  // Handle postback (when user clicks a quick reply button)
  if (event.type === 'postback') {
    const postbackData = event.postback && event.postback.data ? event.postback.data : '';
    console.log('Postback data:', postbackData);
    
    if (postbackData === 'menu') {
      return sendMenuLink(event.replyToken);
    } else if (postbackData === 'order') {
      return sendOrderLink(event.replyToken);
    } else if (postbackData === 'contact') {
      return sendContactInfo(event.replyToken);
    }
    return;
  }
  
  if (event.type !== 'message') return;
  
  const userMessage = event.message ? (event.message.text || '').trim().toLowerCase() : '';
  const userId = event.source.userId;

  console.log('Handling message:', userMessage, 'from user:', userId);

  // Normalize Chinese commands
  const isMenu = userMessage.includes('菜單') || userMessage.includes('menu') || userMessage === '1';
  const isOrder = userMessage.includes('預購') || userMessage.includes('order') || userMessage.includes('訂購') || userMessage === '2';
  const isContact = userMessage.includes('聯絡') || userMessage.includes('contact') || userMessage.includes('聯繫') || userMessage === '4';
  const isHelp = userMessage === '?' || userMessage === '？' || userMessage.includes('help') || userMessage === '3';

  // Handle specific commands
  if (isMenu) {
    return sendMenuLink(event.replyToken);
  } else if (isOrder) {
    return sendOrderLink(event.replyToken);
  } else if (isContact) {
    return sendContactInfo(event.replyToken);
  } else if (isHelp) {
    return sendMainMenu(event.replyToken);
  }

  // Default: show main menu with quick replies
  return sendMainMenu(event.replyToken);
}

async function sendMainMenu(replyToken) {
  try {
    await lineClient.replyMessage(replyToken, {
      type: 'text',
      text: '🧧 祥和蔬食 2027 年菜預購\n\n請選擇服務（直接點選按鈕）：',
      quickReply: {
        items: [
          {
            type: 'action',
            action: { type: 'message', label: '🍽 瀏覽年菜菜單', text: '菜單' }
          },
          {
            type: 'action',
            action: { type: 'message', label: '🛒 開始預購', text: '預購' }
          },
          {
            type: 'action',
            action: { type: 'message', label: '📞 聯絡我們', text: '聯絡' }
          },
          {
            type: 'action',
            action: { type: 'uri', label: '📱 加入LINE好友', uri: 'https://line.me/ti/p/@sxsd1688' }
          }
        ]
      }
    });
  } catch (err) {
    console.error('sendMainMenu error:', err.message);
  }
}

async function sendMenuLink(replyToken) {
  const menuUrl = 'https://serenity-2027-menu-production.up.railway.app';
  try {
    await lineClient.replyMessage(replyToken, {
      type: 'text',
      text: `🍽 【祥和蔬食 2027 年菜菜單】\n\n點選下方連結瀏覽圖文並茂的年菜菜單：\n\n${menuUrl}\n\n所有套餐及單點商品都在這裡！👆`,
      quickReply: {
        items: [
          {
            type: 'action',
            action: { type: 'uri', label: '🍽 開啟年菜菜單', uri: menuUrl }
          },
          {
            type: 'action',
            action: { type: 'message', label: '🛒 我要預購', text: '預購' }
          },
          {
            type: 'action',
            action: { type: 'message', label: '🔙 回主選單', text: '?' }
          }
        ]
      }
    });
  } catch (err) {
    console.error('sendMenuLink error:', err.message);
  }
}

async function sendOrderLink(replyToken) {
  const orderUrl = 'https://serenity-2027-menu-production.up.railway.app';
  try {
    await lineClient.replyMessage(replyToken, {
      type: 'text',
      text: `🛒 【祥和蔬食 2027 年菜預購】\n\n立即線上預購年菜，享用豐盛年味：\n\n${orderUrl}\n\n⚠️ 即日起開放預購，數量有限！\n\n🏠 鎮江店：02-2357-0377\n🏠 慶城店：02-2546-6768`,
      quickReply: {
        items: [
          {
            type: 'action',
            action: { type: 'uri', label: '🛒 開始預購', uri: orderUrl }
          },
          {
            type: 'action',
            action: { type: 'message', label: '🍽 先看菜單', text: '菜單' }
          },
          {
            type: 'action',
            action: { type: 'message', label: '🔙 回主選單', text: '?' }
          }
        ]
      }
    });
  } catch (err) {
    console.error('sendOrderLink error:', err.message);
  }
}

async function sendContactInfo(replyToken) {
  try {
    await lineClient.replyMessage(replyToken, {
      type: 'text',
      text: `📞 【祥和蔬食料理】\n\n🏠 鎮江店\n地址：台北市鎮江街1巷1號\n電話：02-2357-0377 / 2391-7699\n營業：AM 11:00-14:00 / PM 17:00-21:00\n\n🏠 慶城店\n地址：台北市南京東路三段303巷7弄7號\n電話：02-2546-6768 / 2546-6188\n營業：AM 11:30-14:00 / PM 17:30-21:00\n\n📱 LINE：@sxsd1688`,
      quickReply: {
        items: [
          {
            type: 'action',
            action: { type: 'uri', label: '📱 加入LINE好友', uri: 'https://line.me/ti/p/@sxsd1688' }
          },
          {
            type: 'action',
            action: { type: 'message', label: '🛒 開始預購', text: '預購' }
          },
          {
            type: 'action',
            action: { type: 'message', label: '🔙 回主選單', text: '?' }
          }
        ]
      }
    });
  } catch (err) {
    console.error('sendContactInfo error:', err.message);
  }
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
  res.json({ status: 'ok', bot: 'serenity-2027', time: new Date().toISOString(), version: 'QUICK-REPLY-v1' });
});

// ============ 版本診斷 ============
app.get('/api/version', (req, res) => {
  res.json({ 
    version: 'QUICK-REPLY-v1', 
    commit: '74dd355',
    hasQuickReply: true,
    hasCommandHandling: true,
    time: new Date().toISOString() 
  });
});

// ============ 啟動伺服器 ============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`祥和蔬食 2027 年菜系統啟動！端口: ${PORT}`);
  console.log(`年菜 Menu: http://localhost:${PORT}/`);
});
