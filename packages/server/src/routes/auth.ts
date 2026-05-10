import { Router } from 'express';
import * as controller from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication and user management
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username: { type: string, example: alice }
 *               email: { type: string, format: email, example: alice@example.com }
 *               password: { type: string, minLength: 8, example: secret1234 }
 *     responses:
 *       201:
 *         description: Registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post('/register', controller.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Logged in successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/login', controller.login);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout and clear session cookie
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out
 */
router.post('/logout', controller.logout);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get the authenticated user
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/me', authenticateToken, controller.getMe);

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: List all users (for mention suggestions)
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 */
router.get('/users', authenticateToken, controller.getUsers);

/**
 * @swagger
 * /api/auth/profile:
 *   patch:
 *     summary: Update authenticated user's profile (#305 拡張プロフィール項目を含む)
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName: { type: string, nullable: true }
 *               location: { type: string, nullable: true }
 *               avatarUrl: { type: string, nullable: true }
 *               accentColor: { type: string, nullable: true }
 *               bio: { type: string, nullable: true, description: '自己紹介（最大 1000 文字）' }
 *               jobTitle: { type: string, nullable: true, description: '役職（最大 100 文字）' }
 *               department: { type: string, nullable: true, description: '部署（最大 100 文字）' }
 *               timezone: { type: string, nullable: true, description: 'IANA 形式タイムゾーン' }
 *               githubUrl: { type: string, nullable: true, description: 'GitHub URL（http/https）' }
 *               snsUrl: { type: string, nullable: true, description: 'SNS URL（http/https）' }
 *     responses:
 *       200:
 *         description: Updated user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.patch('/profile', authenticateToken, controller.updateProfile);
router.patch('/password', authenticateToken, controller.changePassword);
router.post('/onboarding/complete', authenticateToken, controller.completeOnboarding);
router.patch('/me/status', authenticateToken, controller.updateStatus);

export default router;
