module.exports = {
  apps: [
    {
      name: "vulpine-command-center",
      cwd: "/opt/vulpine-command-center",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3101",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
