import puppeteer, {
  DirectNavigationOptions,
  LaunchOptions,
} from "puppeteer-core";

interface pptrParams extends LaunchOptions {
  executablePath:
    | "/usr/bin/chromium-browser"
    | "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    | string;
  disableList?: ("sandbox" | "extensions" | "gpu")[]; // 啟動屏蔽模塊
  proxy?: string; // 瀏覽器使用代理地址
  abortUrlRegList?: RegExp[]; // 屏蔽請求URL加速加載
}

const objectFilter = function (data, fn) {
  const result = {};

  Object.keys(data).forEach((key) => {
    if (fn(data[key], key, data)) {
      result[key] = data[key];
    }
  });

  return result;
};

async function pptr(params: pptrParams) {
  let mergedParams = {};
  let args = params?.args ?? [];
  // 屏蔽模塊
  if (params.disableList) {
    params.disableList.forEach((item) => {
      if (item === "sandbox") {
        args = args.concat(["--no-sandbox", "--disable-setuid-sandbox"]);
      }
      if (item === "extensions") {
        args.push("--disable-extensions");
      }
      if (item === "gpu") {
        args.push("--disable-gpu");
      }
    });
  }
  // 代理
  if (params.proxy) {
    args.push(params.proxy);
  }
  // 設置默認啟動參數
  mergedParams = {
    slowMo: 100,
    args,
    ...objectFilter(
      params,
      (_, k) => ["disableList", "proxy", "abortUrlRegList"].indexOf(k) === -1
    ),
  };

  const browser = await puppeteer.launch(mergedParams);
  // 初始化頁面先關閉確保沒有空頁面
  await (await browser.pages())[0].close();

  return {
    self: browser,
    newPage: async (url?: string, options?: DirectNavigationOptions) => {
      const page = await browser.newPage();
      // 過濾
      if (params.abortUrlRegList) {
        await page.setRequestInterception(true);
        page.on("request", (req) => {
          let match = false;
          params.abortUrlRegList.forEach((reg) => {
            if (reg.test(req.url())) {
              match = true;
            }
          });
          match ? req.abort() : req.continue();
        });
      }
      if (url) {
        await page.goto(url, options);
      }
      return page;
    },
  };
}

export default pptr;
