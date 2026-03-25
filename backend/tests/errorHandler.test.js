'use strict';

const { errorHandler } = require('../src/middlewares/errorHandler');

const mockReq = { method: 'GET', originalUrl: '/test' };

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler middleware', () => {
  it('responds with err.status and message when err has a status property', () => {
    const res = makeRes();
    const err = Object.assign(new Error('Not found'), { status: 404 });
    errorHandler(err, mockReq, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  it('responds 409 for Postgres unique violation (code 23505)', () => {
    const res = makeRes();
    const err = Object.assign(new Error('duplicate'), { code: '23505' });
    errorHandler(err, mockReq, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Record already exists with this identifier' });
  });

  it('responds 500 for unhandled errors without status or code', () => {
    const res = makeRes();
    errorHandler(new Error('Something exploded'), mockReq, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
