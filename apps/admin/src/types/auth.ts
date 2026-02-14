export interface User {
  id: string
  username: string
  email: string
  roles: string[]
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
}
