const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const { Application, MailSystem } = require('./main');

// 在測試開始前，動態生成 name_list.txt，避免 CI 環境報錯
fs.writeFileSync('name_list.txt', 'Alice\nBob\nCharlie');

test('MailSystem Tests', async (t) => {
  const mailSystem = new MailSystem();

  await t.test('write() should generate correct mail context', () => {
    const context = mailSystem.write('Ray');
    assert.strictEqual(context, 'Congrats, Ray!');
  });

  await t.test('send() should return true when random > 0.5', (t) => {
    // [Stub] 竄改 Math.random 讓它永遠回傳 0.9，強制走成功分支
    t.mock.method(Math, 'random', () => 0.9);
    const result = mailSystem.send('Ray', 'Congrats, Ray!');
    assert.strictEqual(result, true);
  });

  await t.test('send() should return false when random <= 0.5', (t) => {
    // [Stub] 竄改 Math.random 讓它永遠回傳 0.1，強制走失敗分支
    t.mock.method(Math, 'random', () => 0.1);
    const result = mailSystem.send('Ray', 'Congrats, Ray!');
    assert.strictEqual(result, false);
  });
});

test('Application Tests', async (t) => {
  const app = new Application();
  
  // 因為 Application constructor 裡的 Promise 是非同步的
  // 我們稍微等一下，確保 this.people 已經被塞入資料
  await new Promise((resolve) => setTimeout(resolve, 50));

  await t.test('selectNextPerson() should select a new person', (t) => {
    // [Stub] 讓 Math.random() 回傳 0，對應 index 0 ('Alice')
    t.mock.method(Math, 'random', () => 0);
    const person = app.selectNextPerson();
    assert.strictEqual(person, 'Alice');
  });

  await t.test('selectNextPerson() should handle collision (while loop)', (t) => {
    let callCount = 0;
    // [Stub] 第一次回傳 0 (抽到重複的 Alice)，第二次回傳 0.4 (抽到 Bob)
    // 這樣就能完美覆蓋到 while (this.selected.includes(person)) 裡面的邏輯
    t.mock.method(Math, 'random', () => {
      callCount++;
      if (callCount === 1) return 0; // 重複
      return 0.4; // 新的
    });
    
    const person = app.selectNextPerson();
    assert.strictEqual(person, 'Bob');
    assert.strictEqual(callCount, 2); 
  });

  await t.test('selectNextPerson() should return null when all selected', (t) => {
    // 把剩下的人 (Charlie) 抽完
    t.mock.method(Math, 'random', () => 0.9);
    app.selectNextPerson(); // 抽中 Charlie

    // 陣列已滿，再次呼叫應該觸發 all selected 並回傳 null
    const person = app.selectNextPerson();
    assert.strictEqual(person, null);
  });

  await t.test('notifySelected() should call MailSystem methods', (t) => {
    // [Spy] 監視 write 和 send 被呼叫的狀況
    const writeSpy = t.mock.method(app.mailSystem, 'write');
    const sendSpy = t.mock.method(app.mailSystem, 'send');

    app.notifySelected();

    // 總共抽了 3 個人，所以應該要寄 3 封信
    assert.strictEqual(writeSpy.mock.callCount(), 3);
    assert.strictEqual(sendSpy.mock.callCount(), 3);
  });
});

test('Teardown', () => {
  // 測試結束後，把暫存的檔案刪除，保持環境乾淨
  if (fs.existsSync('name_list.txt')) {
    fs.unlinkSync('name_list.txt');
  }
});