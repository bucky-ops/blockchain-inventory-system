import { expect } from 'chai';
import config from '../src/config/appConfig';

describe('Configuration', () => {
  describe('App Configuration', () => {
    it('should have required properties', () => {
      expect(config).to.have.property('env');
      expect(config).to.have.property('server');
      expect(config).to.have.property('database');
      expect(config).to.have.property('redis');
      expect(config).to.have.property('jwt');
      expect(config).to.have.property('api');
      expect(config).to.have.property('monitoring');
    });

    it('should have server configuration', () => {
      expect(config.server).to.have.property('port');
      expect(config.server).to.have.property('host');
      expect(config.server.port).to.be.a('number');
      expect(config.server.host).to.be.a('string');
    });

    it('should have JWT configuration', () => {
      expect(config.jwt).to.have.property('secret');
      expect(config.jwt).to.have.property('refreshSecret');
      expect(config.jwt).to.have.property('expiresIn');
      expect(config.jwt).to.have.property('refreshExpiresIn');
      expect(config.jwt.secret).to.be.a('string');
      expect(config.jwt.refreshSecret).to.be.a('string');
    });

    it('should validate production environment', () => {
      // This would be tested with NODE_ENV=production
      if (config.env === 'production') {
        expect(config.jwt.secret).to.not.equal('change_this_in_production');
        expect(config.jwt.refreshSecret).to.not.equal('change_this_in_production');
        expect(config.database.password).to.not.equal('your_secure_password_here');
      }
    });
  });
});