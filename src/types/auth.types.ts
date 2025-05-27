// User model
export interface User {
    id: string;
    email: string;
    password: string;
    name?: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
  }
  
  // Registration input
  export interface RegisterUserInput {
    email: string;
    password: string;
    name?: string;
  }
  
  // Login input
  export interface LoginUserInput {
    email: string;
    password: string;
  }
  
  // JWT payload
  export interface JwtPayload {
    id: string;
    iat: number;
    exp: number;
  }