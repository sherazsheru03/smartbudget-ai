import { createContext, useState } from "react";
import API from "../services/api";


export const AuthContext = createContext();


export default function AuthContextProvider({ children }) {

    const [token, setToken] = useState(
        localStorage.getItem("token") || null
    );


    const login = async (email, password) => {

        try {

            const response = await API.post("/auth/login", {
                email,
                password
            });


            const token = response.data.token;


            localStorage.setItem("token", token);

            setToken(token);


            return true;


        } catch (error) {

            console.log("Login Error:", error);

            return false;

        }

    };


    const logout = () => {

        localStorage.removeItem("token");

        setToken(null);

    };


    return (

        <AuthContext.Provider
            value={{
                token,
                login,
                logout
            }}
        >

            {children}

        </AuthContext.Provider>

    );

}