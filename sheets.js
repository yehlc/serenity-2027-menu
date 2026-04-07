/**
 * Google Sheets API v4 整合模組
 * 用於祥和 2027 年菜 LINE Bot
 */

const { google } = require('googleapis');

// Google Sheets API 設定
const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1st81uv6oq50n9SOF5c9v9zEIC0SNfVeZIRtMa26zu_8';
const SHEET_NAME = '2027年菜';

// 欄位定義
const HEADERS = [
  '訂單編號',     // A
  '顧客名稱',     // B
  '電話',         // C
  'LINE ID',      // D
  '品項',         // E
  '數量',         // F
  '金額',         // G
  '付款狀態',     // H
  '建立時間',     // I
  '催繳訊息Text'  // J (用於存放催繳訊息模板)
];

let sheetsClient = null;

/**
 * 初始化 Google Sheets API client
 */
function initSheets() {
  try {
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!serviceAccountEmail || !privateKey) {
      console.log('⚠️ Google Sheets 環境變數未設定（GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY）');
      console.log('   Google Sheets 功能將不會作用');
      return false;
    }

    // 解析 private_key（環境變數中的 \n 置換成換行）
    const privateKeyParsed = privateKey.replace(/\\n/g, '\n');

    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKeyParsed,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    sheetsClient = google.sheets({ version: 'v4', auth });
    console.log('✅ Google Sheets API 初始化成功');
    return true;
  } catch (err) {
    console.error('❌ Google Sheets 初始化失敗:', err.message);
    return false;
  }
}

/**
 * 確保工作表存在，若不存在則建立並寫入標題列
 */
async function ensureSheetExists() {
  if (!sheetsClient) return false;

  try {
    // 先取得所有工作表名稱
    const meta = await sheetsClient.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const sheets = meta.data.sheets || [];
    const sheetExists = sheets.some(s => s.properties.title === SHEET_NAME);

    if (!sheetExists) {
      // 建立新工作表
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: SHEET_NAME,
                gridProperties: { rowCount: 1000, columnCount: 12 }
              }
            }
          }]
        }
      });
      console.log(`✅ 已建立工作表：「${SHEET_NAME}」`);

      // 寫入標題列
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A1:J1`,
        valueInputOption: 'RAW',
        resource: { values: [HEADERS] }
      });
      console.log('✅ 已寫入標題列');

      // 寫入公式列（第2列）
      await writeFormulas();
    } else {
      // 檢查標題列是否存在
      const headerCheck = await sheetsClient.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A1:J1`,
        majorDimension: 'ROWS'
      });
      const headerValues = headerCheck.data.values || [];

      if (!headerValues.length || !headerValues[0] || headerValues[0][0] !== '訂單編號') {
        // 標題列損壞或空白，重新寫入
        await sheetsClient.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `${SHEET_NAME}!A1:J1`,
          valueInputOption: 'RAW',
          resource: { values: [HEADERS] }
        });
        console.log('✅ 已重新寫入標題列');
      }

      await writeFormulas();
    }

    return true;
  } catch (err) {
    console.error('❌ ensureSheetExists 錯誤:', err.message);
    return false;
  }
}

/**
 * 寫入公式列（第2列）
 * A2: 總訂單數
 * C2: 已付款數
 * E2: 未付款數
 * H2: 催繳訊息模板（可直接編輯）
 */
async function writeFormulas() {
  if (!sheetsClient) return;

  try {
    // 在 J1 寫入「催繳訊息Text」標題（確認欄位存在）
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!J1:J1`,
      valueInputOption: 'RAW',
      resource: { values: [['催繳訊息Text']] }
    });

    // 在第2列寫入統計公式
    // ROWS 用於計算總列數（資料從第3列開始）
    const formulaRow = [
      '=COUNTA(A3:A1000)',          // A2: 總訂單數
      '',                           // B2
      '=COUNTIF(H3:H1000,"已匯款")', // C2: 已付款數
      '',                           // D2
      '=COUNTIF(H3:H1000,"未付款")', // E2: 未付款數
      '',                           // F2
      '=SUM(G3:G1000)',            // G2: 總金額
      '',                           // H2
      '',                           // I2
      '=B2&" 筆訂單"'              // J2: 摘要（可自訂催繳訊息）
    ];

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A2:J2`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [formulaRow] }
    });

    console.log('✅ 公式列寫入完成');
  } catch (err) {
    console.error('❌ writeFormulas 錯誤:', err.message);
  }
}

/**
 * 將新訂單寫入 Google Sheet（附加到最後一列）
 */
async function appendOrder(order) {
  if (!sheetsClient) {
    console.log('⚠️ sheetsClient 未初始化，跳過寫入 Sheet');
    return false;
  }

  try {
    // 先取得目前有多少筆資料（從第3列開始）
    const getRes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:A`,
      majorDimension: 'ROWS'
    });

    const rows = getRes.data.values || [];
    const nextRow = (rows.length || 1) + 1; // 如果是空的從第2列開始，否則往下追加

    // 組合品項文字
    let itemsText = '';
    if (order.combo && order.combo.name) {
      itemsText = order.combo.name + ' x1';
    }
    if (order.sideDishes && order.sideDishes.length > 0) {
      if (itemsText) itemsText += '、';
      itemsText += order.sideDishes.map(s => `${s.name} x${s.qty}`).join('、');
    }

    // 組合品項數量
    let qtyText = '';
    if (order.combo && order.combo.name) {
      qtyText = '1';
    }
    if (order.sideDishes && order.sideDishes.length > 0) {
      if (qtyText) qtyText += '、';
      qtyText += order.sideDishes.map(s => `${s.qty}`).join('、');
    }

    // 付款狀態文字
    const paymentStatusText = order.paymentStatus === 'paid' ? '已匯款' :
                             order.paymentStatus === 'deposit' ? '已付訂金' : '未付款';

    const rowData = [
      order.id,                    // A: 訂單編號
      order.customer.name,         // B: 顧客名稱
      order.customer.phone,         // C: 電話
      order.lineUserId || '',       // D: LINE ID
      itemsText || '',             // E: 品項
      qtyText || '',               // F: 數量
      order.totalAmount.toString(), // G: 金額
      paymentStatusText,            // H: 付款狀態
      new Date(order.timestamp).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }), // I: 建立時間
      ''                            // J: 催繳訊息（預設空白）
    ];

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A${nextRow}:J${nextRow}`,
      valueInputOption: 'RAW',
      resource: { values: [rowData] }
    });

    console.log(`✅ 訂單 ${order.id} 已寫入 Google Sheet（第${nextRow}列）`);
    return true;
  } catch (err) {
    console.error(`❌ appendOrder 錯誤（${order.id}）:`, err.message);
    return false;
  }
}

/**
 * 取得未付款訂單的 LINE ID 列表
 */
async function getUnpaidLineUsers() {
  if (!sheetsClient) return [];

  try {
    const getRes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A3:J1000`,
      majorDimension: 'ROWS'
    });

    const rows = getRes.data.values || [];
    const unpaidUsers = [];

    for (const row of rows) {
      if (row[7] === '未付款' && row[3]) { // H欄=未付款 且 D欄有LINE ID
        unpaidUsers.push({
          lineUserId: row[3],
          orderId: row[0],
          customerName: row[1]
        });
      }
    }

    return unpaidUsers;
  } catch (err) {
    console.error('❌ getUnpaidLineUsers 錯誤:', err.message);
    return [];
  }
}

/**
 * 更新 J1 催繳訊息文字
 */
async function updateReminderMessage(text) {
  if (!sheetsClient) return false;

  try {
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!J1:J1`,
      valueInputOption: 'RAW',
      resource: { values: [[text]] }
    });
    console.log(`✅ 催繳訊息已更新: ${text}`);
    return true;
  } catch (err) {
    console.error('❌ updateReminderMessage 錯誤:', err.message);
    return false;
  }
}

/**
 * 讀取 J1 催繳訊息文字
 */
async function getReminderMessage() {
  if (!sheetsClient) return null;

  try {
    const getRes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!J1:J1`,
      majorDimension: 'ROWS'
    });
    const values = getRes.data.values || [];
    return (values[0] && values[0][0]) ? values[0][0] : null;
  } catch (err) {
    console.error('❌ getReminderMessage 錯誤:', err.message);
    return null;
  }
}

/**
 * 根據 LINE User ID 更新付款狀態
 */
async function updatePaymentStatusByLineId(lineUserId, last5Digits, paidDate) {
  if (!sheetsClient) return false;

  try {
    const getRes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A3:J1000`,
    });

    const rows = getRes.data.values || [];
    let targetRowIdx = -1;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][3] === lineUserId && rows[i][7] === '未付款') {
        targetRowIdx = i;
        break;
      }
    }

    if (targetRowIdx < 0) return false;

    const actualRow = targetRowIdx + 3; // 因為是從第3列開始

    // 更新付款狀態為「已匯款」
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!H${actualRow}:H${actualRow}`,
      valueInputOption: 'RAW',
      resource: { values: [['已匯款']] }
    });

    return true;
  } catch (err) {
    console.error('❌ updatePaymentStatusByLineId 錯誤:', err.message);
    return false;
  }
}

module.exports = {
  initSheets,
  ensureSheetExists,
  appendOrder,
  getUnpaidLineUsers,
  updateReminderMessage,
  getReminderMessage,
  updatePaymentStatusByLineId
};
