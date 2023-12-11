import React, { useState, useEffect } from 'react';
import CalendarComponent from './CalendarComponent';

const API_URL = process.env.REACT_APP_API_URL;

const MainComponent = ({ authHeader, onLogout }) => {
    const [data, setData] = useState(null);

    useEffect(() => {
        fetch(API_URL+'/', {
            headers: authHeader ? { 'Authorization': authHeader } : {}
        })
        .then(response => {
            if (response.status === 401) {
                onLogout();
            }
            return response.json();
        })
        .then(data => setData(data))
        .catch(error => console.error('Error fetching data:', error));
    }, [authHeader, onLogout]);

    const fetchTeamData = async () => {
        try {
            const response = await fetch(API_URL+'/', {
                headers: authHeader ? { 'Authorization': authHeader } : {}
            });
            if (response.status === 401) {
                onLogout(); // Call logout handler on 401 response
                return;
            }
            const data = await response.json();
            setData(data);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    if (!data) return <div>Loading...</div>;

    return (
        <CalendarComponent teamData={data.teams} holidays={data.holidays} currentMonth={new Date()} updateTeamData={fetchTeamData} authHeader={authHeader}/>
    );
};

export default MainComponent;
