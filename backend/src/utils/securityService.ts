import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  tag: string;
}

export interface HashResult {
  hash: string;
  salt: string;
}

export class SecurityService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly saltLength = 16;
  private readonly tagLength = 16;

  constructor(private encryptionKey: string) {
    if (!encryptionKey || encryptionKey.length < 32) {
      throw new Error('Encryption key must be at least 32 characters');
    }
  }

  /**
   * Encrypts sensitive data using AES-256-GCM
   */
  public encrypt(data: string): EncryptionResult {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, Buffer.from(this.encryptionKey));
      cipher.setAAD(Buffer.from('inventory-system', 'utf8'));

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error}`);
    }
  }

  /**
   * Decrypts data using AES-256-GCM
   */
  public decrypt(encryptedData: EncryptionResult): string {
    try {
      const decipher = crypto.createDecipher(this.algorithm, Buffer.from(this.encryptionKey));
      decipher.setAAD(Buffer.from('inventory-system', 'utf8'));
      decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));

      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error}`);
    }
  }

  /**
   * Hashes sensitive data using SHA-256 with salt
   */
  public hash(data: string): HashResult {
    try {
      const salt = crypto.randomBytes(this.saltLength).toString('hex');
      const hash = crypto
        .createHash('sha256')
        .update(data + salt)
        .digest('hex');

      return { hash, salt };
    } catch (error) {
      throw new Error(`Hashing failed: ${error}`);
    }
  }

  /**
   * Verifies hash against original data
   */
  public verifyHash(data: string, hash: string, salt: string): boolean {
    try {
      const computedHash = crypto
        .createHash('sha256')
        .update(data + salt)
        .digest('hex');

      return computedHash === hash;
    } catch (error) {
      return false;
    }
  }

  /**
   * Hashes password using bcrypt
   */
  public async hashPassword(password: string, rounds: number = 12): Promise<string> {
    try {
      return await bcrypt.hash(password, rounds);
    } catch (error) {
      throw new Error(`Password hashing failed: ${error}`);
    }
  }

  /**
   * Verifies password against hash
   */
  public async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      return false;
    }
  }

  /**
   * Generates cryptographically secure random token
   */
  public generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generates cryptographically secure random number
   */
  public generateRandomNumber(min: number, max: number): number {
    const range = max - min + 1;
    const bytes = Math.ceil(Math.log2(range) / 8);
    const maxVal = Math.pow(256, bytes);
    const randomBytes = crypto.randomBytes(bytes);
    const randomNum = randomBytes.readUIntBE(0, bytes);
    
    return min + (randomNum % range);
  }

  /**
   * Creates HMAC signature for message integrity
   */
  public createHMAC(message: string, secret: string): string {
    try {
      return crypto
        .createHmac('sha256', secret)
        .update(message)
        .digest('hex');
    } catch (error) {
      throw new Error(`HMAC creation failed: ${error}`);
    }
  }

  /**
   * Verifies HMAC signature
   */
  public verifyHMAC(message: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = this.createHMAC(message, secret);
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Generates key pair for asymmetric encryption
   */
  public generateKeyPair(): { publicKey: string; privateKey: string } {
    try {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });

      return { publicKey, privateKey };
    } catch (error) {
      throw new Error(`Key pair generation failed: ${error}`);
    }
  }

  /**
   * Encrypts data using public key (asymmetric)
   */
  public encryptWithPublicKey(data: string, publicKey: string): string {
    try {
      return crypto.publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        Buffer.from(data)
      ).toString('base64');
    } catch (error) {
      throw new Error(`Public key encryption failed: ${error}`);
    }
  }

  /**
   * Decrypts data using private key (asymmetric)
   */
  public decryptWithPrivateKey(encryptedData: string, privateKey: string): string {
    try {
      return crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        Buffer.from(encryptedData, 'base64')
      ).toString('utf8');
    } catch (error) {
      throw new Error(`Private key decryption failed: ${error}`);
    }
  }

  /**
   * Creates digital signature
   */
  public createSignature(data: string, privateKey: string): string {
    try {
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(data);
      return sign.sign(privateKey, 'base64');
    } catch (error) {
      throw new Error(`Signature creation failed: ${error}`);
    }
  }

  /**
   * Verifies digital signature
   */
  public verifySignature(data: string, signature: string, publicKey: string): boolean {
    try {
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(data);
      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      return false;
    }
  }

  /**
   * Derives encryption key from password using PBKDF2
   */
  public deriveKey(password: string, salt: string, iterations: number = 100000): string {
    try {
      return crypto
        .pbkdf2Sync(password, salt, iterations, this.keyLength, 'sha256')
        .toString('hex');
    } catch (error) {
      throw new Error(`Key derivation failed: ${error}`);
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  public constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Sanitizes input data to prevent injection attacks
   */
  public sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/['"]/g, '') // Remove quotes
      .replace(/--/g, '') // Remove SQL comment markers
      .replace(/[;&|`$(){}[\]]/g, ''); // Remove shell special characters
  }

  /**
   * Generates UUID v4
   */
  public generateUUID(): string {
    return crypto.randomUUID();
  }
}

export default SecurityService;