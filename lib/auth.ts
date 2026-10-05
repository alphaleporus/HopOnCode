import {NextAuthOptions} from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import {AUTH_SECRET} from '@/lib/authSecret';

// Demo-only in-memory user (plaintext, publicly documented credentials).
// Enabled in development; production builds require ENABLE_DEMO_LOGIN=true (e.g. a judged demo deploy).
// Replace with a real user store + hashed passwords before handling real users.
const DEMO_LOGIN_ENABLED =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEMO_LOGIN === 'true';

const users = DEMO_LOGIN_ENABLED
    ? [
        {
            id: '1',
            email: 'demo@fleetfusion.com',
            password: 'demo123',
            name: 'Demo User',
            role: 'user',
        },
    ]
    : [];

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: {label: 'Email', type: 'email', placeholder: 'user@example.com'},
                password: {label: 'Password', type: 'password'},
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Please enter email and password');
                }

                // Find user
                const user = users.find(
                    (u) => u.email === credentials.email && u.password === credentials.password
                );

                if (!user) {
                    throw new Error('Invalid email or password');
                }

                // Return user object (without password)
                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                };
            },
        }),
    ],
    callbacks: {
        async jwt({token, user}) {
            if (user) {
                token.id = user.id;
                token.role = user.role;
            }
            return token;
        },
        async session({session, token}) {
            if (session.user) {
                session.user.id = token.id;
                session.user.role = token.role;
            }
            return session;
        },
    },
    pages: {
        signIn: '/login',
        error: '/login',
    },
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    secret: AUTH_SECRET,
    debug: process.env.NODE_ENV === 'development',
};
