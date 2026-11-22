export const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL']?.trim();

export const databaseName = (url: string): string =>
  decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));

export const adminUrl = (url: string): string => {
  const admin = new URL(url);
  admin.pathname = '/postgres';
  return admin.toString();
};

export const assertTestDatabase = (url: string): string => {
  const name = databaseName(url);
  if (!/^[A-Za-z0-9_]+_test$/.test(name)) {
    throw new Error(
      `TEST_DATABASE_URL debe apuntar a una base cuyo nombre termine en _test (recibí «${name}»)`,
    );
  }
  return name;
};
