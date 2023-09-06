export const ENV = process.env.ENV || '';
export const MSSQL_HOST = process.env.MSSQL_HOST || 'localhost';
export const MSSQL_PORT = Number(process.env.MSSQL_PORT) || 1433;
export const MSSQL_USER = process.env.MSSQL_USER || 'root';
export const MSSQL_PASSWORD = process.env.MSSQL_PASSWORD || '';
export const MSSQL_DATABASE = process.env.MSSQL_DATABASE || '';
export const MONGO_HOST = process.env.MONGO_HOST || 'localhost';
export const MONGO_PORT = Number(process.env.MONGO_PORT) || 27017;
export const MONGO_USER = process.env.MONGO_USER || 'root';
export const MONGO_PASSWORD = process.env.MONGO_PASSWORD || '';
export const MONGO_DATABASE = process.env.MONGO_DATABASE || '';
export const BBB_ML_BASE_URL = process.env.BBB_ML_BASE_URL || '';
export const BBB_ML_SECRET_HEADER = process.env.BBB_ML_SECRET_HEADER || 'x-bbb-secret-client';
export const BBB_ML_SECRET_HEADER_VALUE = process.env.BBB_ML_SECRET_HEADER_VALUE || '';
export const FORCE_SYNC = !!process.env.FORCE_SYNC;