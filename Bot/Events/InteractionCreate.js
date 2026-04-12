module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // ✅ التعامل مع الاقتراحات التلقائية
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;

      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error(`❌ Error in autocomplete for ${interaction.commandName}:`, error);
      }
      return;
    }

    // ✅ التعامل مع تنفيذ الأوامر
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`❌ Error in command ${interaction.commandName}:`, error);

        // تجاهل لو الـ interaction منتهية
        if (error.code === 10062) return;

        const errorReply = {
          content: '❌ An error occurred while executing the command.',
          flags: 64
        };

        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorReply);
          } else {
            await interaction.reply(errorReply);
          }
        } catch (replyError) {
          if (replyError.code !== 10062) {
            console.error(`❌ Could not send error reply:`, replyError);
          }
        }
      }
      return;
    }

    // ✅ التعامل مع الأزرار - بشكل عام
    if (interaction.isButton()) {
        console.log(`🔄 Button: ${interaction.customId}`);

        try {
            // ========== أزرار الجيفاواي ==========
            if (interaction.customId.startsWith('giveaway_')) {
                console.log(`🎁 Giveaway button: ${interaction.customId} by ${interaction.user.tag}`);

                const giveawayCommand = client.commands.get('giveaway');
                if (giveawayCommand?.buttonHandler) {
                    try {
                        await giveawayCommand.buttonHandler(interaction);
                    } catch (error) {
                        console.error('Error in giveaway button handler:', error);
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
                        }
                    }
                    return;
                } else {
                    console.warn('⚠️ Giveaway command has no buttonHandler!');
                    return;
                }
            }

                // ========== أزرار الجيفاواي المجتمعية (الجديدة) ==========
                else if (interaction.customId.startsWith('commgiveaway_')) {
                    console.log(`🎁 Community giveaway button: ${interaction.customId} by ${interaction.user.tag}`);
                    const communityGiveawayCommand = client.commands.get('communitygiveaway');
                    if (communityGiveawayCommand?.buttonHandler) {
                        await communityGiveawayCommand.buttonHandler(interaction);
                        return;
                    } else {
                        console.warn('⚠️ Community giveaway command has no buttonHandler!');
                        return;
                    }
                }

                    //======================= أزرار الأحداث =======================
                    else if (interaction.customId.startsWith('partner_accept:') || interaction.customId.startsWith('partner_decline:')) {
                        console.log(`🤝 Partner button: ${interaction.customId}`);
                        const signupCommand = client.commands.get('signup');
                        if (signupCommand?.buttonHandler) {
                            await signupCommand.buttonHandler(interaction);
                            return;
                        } else {
                            await interaction.reply({ content: '❌ Signup command not available.', ephemeral: true });
                            return;
                        }
                    }

                        else if (interaction.customId === 'progress_agent' || interaction.customId === 'progress_routine' || interaction.customId === 'progress_limited') {
                            // These buttons are handled by the /progress command's own collector.
                            // Do nothing here; the collector will handle the interaction.
                            console.log(`📊 Progress button: ${interaction.customId}`);
                            return;
                        }

                

            // ========== أي زر تاني مش معروف ==========
            else {
                console.log(`❓ Unknown button: ${interaction.customId}`);
                try {
                    await interaction.reply({
                        content: '❌ This button is not active anymore.',
                        ephemeral: true
                    });
                } catch (replyError) {
                    if (replyError.code !== 10062) {
                        console.error('Could not send unknown button reply:', replyError);
                    }
                }
                return;
            }

        } catch (error) {
            console.error(`❌ Error in button handler:`, error);
            if (error.code === 10062) return;
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ Error processing button click. Please try again.',
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                if (replyError.code !== 10062) {
                    console.error(`❌ Could not send error message:`, replyError);
                }
            }
        }
    }

    // ✅ التعامل مع المودالات
    if (interaction.isModalSubmit()) {
      try {
        for (const [cmdName, command] of client.commands) {
          if (command.modalHandler) {
            try {
              await command.modalHandler(interaction);
              return;
            } catch (error) {
              if (error.code === 10062) return;
              continue;
            }
          }
        }

        try {
            await interaction.reply({
                content: '❌ This form is no longer active.',
                ephemeral: true
            });
        } catch (replyError) {
            if (replyError.code !== 10062) {
                console.error('Could not send modal expired reply:', replyError);
            }
        }

      } catch (error) {
        console.error(`❌ Error in modal handler for ${interaction.customId}:`, error);
        if (error.code === 10062) return;

        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: `❌ Error: ${error.message.substring(0, 100)}`,
                    ephemeral: true
                });
            } else {
                await interaction.followUp({
                    content: '❌ An error occurred while processing the form.',
                    ephemeral: true
                });
            }
        } catch (replyError) {
            if (replyError.code !== 10062) {
                console.error('Could not send modal error reply:', replyError);
            }
        }
      }
      return;
    }

    // ✅ التعامل مع Select Menus
    if (interaction.isStringSelectMenu()) {
      try {
        for (const [commandName, command] of client.commands) {
          if (command.selectMenuHandler) {
            try {
              await command.selectMenuHandler(interaction);
              return;
            } catch (error) {
              if (error.code === 10062) return;
              continue;
            }
          }
        }

        try {
            await interaction.reply({
                content: '❌ This list is no longer active.',
                ephemeral: true
            });
        } catch (replyError) {
            if (replyError.code !== 10062) {
                console.error('Could not send select menu expired reply:', replyError);
            }
        }

      } catch (error) {
        console.error(`❌ Error in select menu handler for ${interaction.customId}:`, error);
        if (error.code === 10062) return;

        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred while processing the list.',
                    ephemeral: true
                });
            }
        } catch (replyError) {
            if (replyError.code !== 10062) {
                console.error('Could not send select menu error reply:', replyError);
            }
        }
      }
      return;
    }

    // ✅ التعامل مع Context Menus
    if (interaction.isContextMenuCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`❌ Error in context menu ${interaction.commandName}:`, error);
        if (error.code === 10062) return;

        const errorReply = {
          content: '❌ Something wrong happened.',
          ephemeral: true
        };

        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorReply);
            } else {
                await interaction.reply(errorReply);
            }
        } catch (replyError) {
            if (replyError.code !== 10062) {
                console.error('Could not send context menu error reply:', replyError);
            }
        }
      }
      return;
    }
  }
};