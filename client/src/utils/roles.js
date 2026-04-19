export const ROLE_LABELS = {
  customer: 'Клієнт',
  content_manager: 'Контент-менеджер',
  warehouse_manager: 'Менеджер складу',
  sales_processor: 'Менеджер з продажу',
  manager: 'Менеджер',
  admin: 'Адміністратор',
};

export const STAFF_ROLES = [
  'admin',
  'manager',
  'content_manager',
  'warehouse_manager',
  'sales_processor',
];

const BACKOFFICE_LINKS = {
  admin: [
    { path: '/admin', label: 'Адмін-панель' },
    { path: '/manager', label: 'Операційна панель' },
  ],
  manager: [
    { path: '/manager', label: 'Операційна панель' },
    { path: '/admin', label: 'Адмін-панель' },
  ],
  content_manager: [
    { path: '/admin', label: 'Адмін-панель' },
  ],
  warehouse_manager: [
    { path: '/manager', label: 'Операційна панель' },
    { path: '/admin', label: 'Адмін-панель' },
  ],
  sales_processor: [
    { path: '/manager', label: 'Операційна панель' },
    { path: '/admin', label: 'Адмін-панель' },
  ],
};

export const getRoleLabel = (role) => ROLE_LABELS[role] || ROLE_LABELS.customer;

export const isStaffRole = (role) => STAFF_ROLES.includes(role);

export const getBackofficeLinks = (role) => BACKOFFICE_LINKS[role] || [];

export const getRoleLandingPath = (role) => getBackofficeLinks(role)[0]?.path || '/';

