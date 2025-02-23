import axios from "axios";
const api_url = "http://localhost:5000";

export const addTask = async (post) => {
  try {
    const response = await axios.post(`${api_url}/tasks`, post);
    return response.data;
  } catch (error) {
    return {
      message: "error in adding data",
      error: error.message,
    };
  }
};

export const getTasks = async () => {
  try {
    const response = await axios.get(`${api_url}/tasks`);
    return response.data;
  } catch (error) {
    return {
      message: "error in getting data",
      error: error.message,
    };
  }
};

export const updateTask = async (id, post) => {
  try {
    const response = await axios.put(`${api_url}/tasks/${id}`, post);
    return response.data;
  } catch (error) {
    return {
      message: "error in updating data",
      error: error.message,
    };
  }
};

export const deleteTask = async (id) => {
  try {
    const response = await axios.delete(`${api_url}/tasks/${id}`);
    return response.data;
  } catch (error) {
    return {
      message: "error in deleting data",
      error: error.message,
    };
  }
};
