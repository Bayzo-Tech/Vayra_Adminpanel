import { useContext } from 'react';
import { AuthContext } from './AuthContextInstance';

export const useAuth = () => useContext(AuthContext);