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
            // ========== 1. أزرار الجيفاواي ==========

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

            // ========== 2. أزرار المتجر العادي ==========
            else if (interaction.customId === 'shop_next_page' || 
                 interaction.customId === 'shop_prev_page' || 
                 interaction.customId.startsWith('buy_item_') || 
                 interaction.customId.startsWith('refund_')) {
                console.log(`🛒 Shop button: ${interaction.customId}`);

                const shopCommand = client.commands.get('shop');
                if (shopCommand?.buttonHandler) {
                    await shopCommand.buttonHandler(interaction);
                    return;
                }
            }

            // ========== 3. أزرار تعديل المتجر ==========
            else if (interaction.customId.startsWith('shopedit_') || 
               interaction.customId.startsWith('delete_item_') || 
               interaction.customId.startsWith('edit_item_') || 
               interaction.customId === 'add_item' ||
               interaction.customId === 'apply_sale' ||
               interaction.customId === 'cancel_sale' ||
               interaction.customId === 'prev_page' ||
               interaction.customId === 'next_page') {
                console.log(`✏️ ShopEdit button: ${interaction.customId}`);

                const shopeditCommand = client.commands.get('shopedit');
                if (shopeditCommand?.buttonHandler) {
                    await shopeditCommand.buttonHandler(interaction);
                    return;
                }
            }

            // ========== 4. أزرار الكرات ==========
            else if (interaction.customId.startsWith('open_crate_')) {
                try {
                    console.log(`📦 Open crate button: ${interaction.customId}`);

                    const dropsCommand = client.commands.get('drops');
                    if (dropsCommand?.buttonHandler) {
                        await dropsCommand.buttonHandler(interaction);
                        return;
                    } else {
                        await interaction.reply({ 
                            content: '❌ Cannot open crate right now.', 
                            ephemeral: true 
                        });
                        return;
                    }
                } catch (error) {
                    console.error('Error in open_crate button:', error);
                    if (error.code === 10062) return;
                    if (!interaction.replied && !interaction.deferred) {
                        try {
                            await interaction.reply({
                                content: '❌ Error opening crate.',
                                ephemeral: true
                            });
                        } catch (replyError) {
                            if (replyError.code !== 10062) {
                                console.error('Could not send crate error reply:', replyError);
                            }
                        }
                    }
                }
                return;
            }

            // ========== 5. أزرار الباف ==========
            else if (interaction.customId === 'buff_accept' || interaction.customId === 'buff_reject') {
                console.log(`✨ Buff button: ${interaction.customId} by ${interaction.user.tag}`);

                const dropsCommand = client.commands.get('drops');
                if (dropsCommand?.buttonHandler) {
                    await dropsCommand.buttonHandler(interaction);
                    return;
                } else {
                    try {
                        await interaction.reply({ 
                            content: '❌ This button is no longer active.', 
                            flags: 64 
                        });
                    } catch (replyError) {
                        if (replyError.code !== 10062) {
                            console.error('Could not send buff error reply:', replyError);
                        }
                    }
                    return;
                }
            }

            // ========== 6. أزرار الخلفية ==========
            else if (interaction.customId.startsWith('wallpaper_')) {
                console.log(`🎨 Wallpaper button: ${interaction.customId}`);

                const wallpaperCommand = client.commands.get('setwallpaper');
                if (wallpaperCommand?.handleButtonInteraction) {
                    await wallpaperCommand.handleButtonInteraction(interaction);
                    return;
                } else {
                    try {
                        await interaction.reply({ 
                            content: '❌ Cannot process wallpaper request.', 
                            ephemeral: true 
                        });
                    } catch (replyError) {
                        if (replyError.code !== 10062) {
                            console.error('Could not send wallpaper error reply:', replyError);
                        }
                    }
                    return;
                }
            }

            // ========== 7. أزرار الـ Exchange ==========
            else if (interaction.customId.startsWith('exchange_')) {
                console.log(`💎 Exchange button: ${interaction.customId}`);
                return;
            }

            // ========== 8. أزرار الـ Reset ==========
            else if (interaction.customId === 'confirm_reset' || interaction.customId === 'cancel_reset') {
                console.log(`🔄 Reset button: ${interaction.customId}`);
                return;
            }

            // ========== 9. أزرار GiftCrate ==========
            else if (interaction.customId === 'confirm_addcrates' || interaction.customId === 'cancel_addcrates') {
                console.log(`🎁 GiftCrate button: ${interaction.customId}`);
                return;
            }

            // ========== 10. أزرار GiftWallet ==========
            else if (interaction.customId === 'confirm_addcoins' || interaction.customId === 'cancel_addcoins') {
                console.log(`💰 GiftWallet button: ${interaction.customId}`);
                return;
            }

            // ========== 11. أزرار ResetWell ==========
            else if (interaction.customId === 'confirm_resetwell' || interaction.customId === 'cancel_resetwell') {
                console.log(`🔄 ResetWell button: ${interaction.customId}`);
                return;
            }

            // ========== 11. أزرار Leaderboard ==========
            else if (['lb_next_page', 'lb_prev_page', 'filter_xp', 'filter_coins', 'filter_crystals', 'filter_wishes', 'filter_heat'].includes(interaction.customId)) {
                console.log(`🏆 Leaderboard button: ${interaction.customId}`);
                return;
            }

            // ========== 12. أزرار Progress buttons ==========
            else if (interaction.customId === 'progress_challenges' || 
                interaction.customId === 'progress_crates') {
                console.log(`📊 Progress button: ${interaction.customId}`);
                return;
            }

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

                else if (interaction.customId === 'egg_collect') {
                    console.log(`🥚 Egg collect button: ${interaction.user.tag}`);
                    if (global.eggSystem) {
                        await global.eggSystem.handleCollect(interaction);
                        return;
                    } else {
                        await interaction.reply({ 
                            content: '❌ Egg system is not active.', 
                            ephemeral: true 
                        });
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
        if (interaction.customId.startsWith('shop_')) {
            console.log(`🛒 Shop modal: ${interaction.customId}`);

            const shopCommand = client.commands.get('shopedit');
            if (shopCommand?.modalHandler) {
                await shopCommand.modalHandler(interaction);
                return;
            }
        }

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
        if (interaction.customId === 'rates_select_menu') {
          console.log(`📊 Rates select menu pressed - Value: ${interaction.values[0]}`);

          const ratesCommand = client.commands.get('rates');
          if (ratesCommand?.selectMenuHandler) {
            await ratesCommand.selectMenuHandler(interaction);
            return;
          } else {
            try {
                await interaction.reply({ 
                    content: '❌ Rates system is not available.', 
                    ephemeral: true 
                });
            } catch (replyError) {
                if (replyError.code !== 10062) {
                    console.error('Could not send rates error reply:', replyError);
                }
            }
            return;
          }
        }

        if (interaction.customId === 'buff_type_select') {
            console.log(`⚡ Buff select menu: ${interaction.customId}`);

            const shopeditCommand = client.commands.get('shopedit');
            if (shopeditCommand?.selectMenuHandler) {
                await shopeditCommand.selectMenuHandler(interaction);
                return;
            }
        }

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