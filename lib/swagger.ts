export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "FlowDeck Engineering PM - REST API",
    version: "1.0.1",
    description:
      "سامانه جامع مدیریت پروژه مهندسی و نظارت تیمی FlowDeck. شامل مستندات اندپوینت‌های احراز هویت، سازمان، پروژه‌ها، تسک‌ها، اعضا و بایگانی بر مبنای متدولوژی Spec-Kit.",
    contact: {
      name: "Engineering Team",
      email: "amiriartin185@gmail.com",
    },
  },
  servers: [
    {
      url: "/",
      description: "Current Server Instance",
    },
  ],
  tags: [
    { name: "Auth & Identity", description: "احراز هویت، ثبت‌نام مدیرعامل و اعتبارسنجی کد ملی" },
    { name: "Workspaces & Organization", description: "مدیریت فضاهای کاری، سازمان و کدهای دعوت" },
    { name: "Projects & Lifecycle", description: "مدیریت چرخه حیات پروژه، ایجاد، به‌روزرسانی، حذف و بایگانی" },
    { name: "Project Members & RBAC", description: "تخصیص اعضا و سطوح دسترسی در پروژه‌ها" },
    { name: "Issues & Sprints", description: "مدیریت تسک‌ها، باگ‌ها، اسپرینت‌ها و مایلستون‌ها" },
    { name: "Activity & Notifications", description: "لاگ فعالیت‌ها و اعلانات درون‌برنامه‌ای" },
  ],
  paths: {
    "/api/v1/auth/verify-national-id": {
      post: {
        tags: ["Auth & Identity"],
        summary: "اعتبارسنجی الگوریتمی کد ملی و تایید مدارک مدیرعامل",
        description: "بررسی صحت کد ملی ۱۰ رقمی بر اساس الگوریتم ریاضی کشور و تایید مدارک مدیرعامل توسط پلتفرم.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  nationalId: { type: "string", example: "0012345678" },
                  targetUserId: { type: "string", format: "uuid" },
                  approve: { type: "boolean", example: true },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "نتیجه موفقیت‌آمیز اعتبارسنجی" },
          "400": { description: "کد ملی نامعتبر است" },
          "403": { description: "عدم دسترسی کافی" },
        },
      },
    },
    "/api/v1/workspaces": {
      get: {
        tags: ["Workspaces & Organization"],
        summary: "دریافت فهرست فضاهای کاری کاربر",
        responses: {
          "200": { description: "لیست فضاهای کاری مجاز برای کاربر" },
          "401": { description: "عدم احراز هویت" },
        },
      },
      post: {
        tags: ["Workspaces & Organization"],
        summary: "ایجاد فضای کاری / سازمان جدید",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", example: "سازمان مهندسی رویکرد" },
                  slug: { type: "string", example: "roykard-tech" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "سازمان با موفقیت ایجاد شد" },
        },
      },
    },
    "/api/v1/members": {
      get: {
        tags: ["Workspaces & Organization"],
        summary: "دریافت اعضای سازمان به همراه نقش‌ها و وضعیت زیرمجموعه",
        responses: {
          "200": { description: "لیست اعضای فعال سازمان" },
        },
      },
    },
    "/api/v1/projects": {
      get: {
        tags: ["Projects & Lifecycle"],
        summary: "دریافت پروژه‌ها بر اساس نقش (RBAC)",
        description: "مدیرعامل تمام پروژه‌ها را می‌بیند؛ اعضای عادی فقط پروژه‌های تخصیص‌یافته به خود را مشاهده می‌کنند.",
        parameters: [
          {
            name: "workspaceId",
            in: "query",
            schema: { type: "string" },
            description: "شناسه فیلتر فضای کاری (اختیاری)",
          },
        ],
        responses: {
          "200": { description: "فهرست پروژه‌ها با متادیتای پیشرفت و سلامت" },
        },
      },
      post: {
        tags: ["Projects & Lifecycle"],
        summary: "ایجاد پروژه جدید در دیتابیس (DB-First)",
        description: "ثبت مستقیم پروژه در دیتابیس Supabase بدون وابستگی به حافظه محلی مرورگر.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "key"],
                properties: {
                  name: { type: "string", example: "سیستم مدیریت مهندسی" },
                  key: { type: "string", example: "ENG" },
                  description: { type: "string" },
                  targetDate: { type: "string", format: "date" },
                  githubRepo: { type: "string", example: "Artin990/engineering-pm" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "پروژه در دیتابیس ایجاد شد" },
          "400": { description: "ورودی ناقص یا کلید تکراری" },
        },
      },
      delete: {
        tags: ["Projects & Lifecycle"],
        summary: "حذف پروژه به همراه تمام داده‌های وابسته (مخصوص مدیرعامل)",
        parameters: [
          {
            name: "key",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "کلید پروژه جهت حذف",
          },
        ],
        responses: {
          "200": { description: "پروژه با موفقیت حذف شد" },
          "403": { description: "تنها مدیرعامل مجاز به حذف است" },
        },
      },
    },
    "/api/v1/projects/{key}/sync": {
      get: {
        tags: ["Projects & Lifecycle"],
        summary: "واکشی کلیه داده‌های یک پروژه (تسک‌ها، اعضا، مایلستون‌ها و سایکل‌ها)",
        parameters: [
          {
            name: "key",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "کلید پروژه",
          },
        ],
        responses: {
          "200": { description: "داده‌های کامل پروژه از دیتابیس" },
          "404": { description: "پروژه یافت نشد" },
        },
      },
      post: {
        tags: ["Projects & Lifecycle"],
        summary: "همگام‌سازی و پایدارسازی دسته‌جمعی داده‌های پروژه در دیتابیس",
        parameters: [
          {
            name: "key",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "اطلاعات با موفقیت در دیتابیس ذخیره شد" },
        },
      },
    },
    "/api/v1/projects/{key}/archive": {
      post: {
        tags: ["Projects & Lifecycle"],
        summary: "تایید نهایی و بایگانی پروژه تکمیل‌شده (US7)",
        description: "تغییر وضعیت پروژه به archived و ثبت در بورد انجام‌شده‌ها پس از تایید مدیرعامل/کارفرما.",
        parameters: [
          {
            name: "key",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  successRate: { type: "integer", default: 100 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "پروژه با موفقیت بایگانی شد" },
          "403": { description: "عدم دسترسی کارفرما/مدیرعامل" },
        },
      },
    },
    "/api/v1/projects/{key}/members": {
      get: {
        tags: ["Project Members & RBAC"],
        summary: "دریافت اعضای تخصیص‌یافته به یک پروژه",
        parameters: [
          {
            name: "key",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "فهرست اعضای پروژه همراه با نقش" },
        },
      },
      post: {
        tags: ["Project Members & RBAC"],
        summary: "تخصیص عضو با نقش مشخص به پروژه (US5)",
        parameters: [
          {
            name: "key",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["userId", "role"],
                properties: {
                  userId: { type: "string", format: "uuid" },
                  role: { type: "string", enum: ["lead", "contributor", "viewer"], default: "contributor" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "عضو با موفقیت به پروژه اختصاص یافت" },
        },
      },
    },
    "/api/v1/projects/{projectId}/issues": {
      get: {
        tags: ["Issues & Sprints"],
        summary: "دریافت لیست تسک‌های پروژه",
        parameters: [
          {
            name: "projectId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "فهرست تسک‌ها" },
        },
      },
      post: {
        tags: ["Issues & Sprints"],
        summary: "ایجاد تسک جدید در پروژه",
        parameters: [
          {
            name: "projectId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  status: { type: "string", enum: ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"] },
                  priority: { type: "string", enum: ["urgent", "high", "medium", "low", "none"] },
                  estimate: { type: "integer", default: 1 },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "تسک با موفقیت در دیتابیس ثبت شد" },
        },
      },
    },
    "/api/v1/notifications": {
      get: {
        tags: ["Activity & Notifications"],
        summary: "دریافت اعلانات زنده کاربر",
        responses: {
          "200": { description: "لیست نوتیفیکیشن‌ها" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "sb-access-token",
      },
    },
  },
};
